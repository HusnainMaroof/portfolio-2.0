// End-to-end test with the mock provider: no tokens spent, real git, real vault.
// Scenario: research task, then a high-risk coding task that needs owner approval.
// The first coder ("a-lazy") changes nothing twice, gets reassigned; "b-good" fixes
// the bug and the slow path; the engine verifies tests + a before/after metric,
// another model reviews, the senior confirms, and the work is merged to orch/<run>.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.ts";
import { Engine } from "../src/engine.ts";
import { git, writeJson } from "../src/util.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-e2e-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);
fs.writeFileSync(path.join(repo, "math.js"), "exports.slow = true;\nexports.add = (a, b) => a - b;\n");
fs.writeFileSync(path.join(repo, "test.js"), "const { add } = require('./math');\nif (add(2, 3) !== 5) { console.error('add(2,3) = ' + add(2, 3)); process.exit(1); }\nconsole.log('ok');\n");
fs.writeFileSync(path.join(repo, "bench.js"), "const { slow } = require('./math');\nconsole.log('latency ms', slow ? 200 : 40);\n");
git(repo, "init", "-q", "-b", "main");
git(repo, "add", ".");
git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");

const script = path.join(tmp, "mock.json");
writeJson(script, {
  models: [
    { model: "senior", tier: "premium" },
    { model: "a-lazy", tier: "strong" },
    { model: "b-good", tier: "strong" },
  ],
  understand: { goal: "Fix add() and make it fast", constraints: [], successCriteria: ["node test.js passes", "bench below 200"], assumptions: [], questions: [] },
  plan: {
    tasks: [
      { id: "t1", title: "Find why add is wrong", category: "research", risk: "low", brief: "Trace add()", files: [], deps: [], checks: [] },
      {
        id: "t2", title: "Fix add and the slow path", category: "coding", risk: "high", brief: "Fix add(); turn off slow.", files: ["math.js"], deps: ["t1"],
        checks: [{ name: "tests", cmd: "node test.js" }, { name: "latency", cmd: "node bench.js", measure: true, expect: "lower" }],
      },
    ],
  },
  edits: { "b-good": [{ file: "math.js", find: "a - b", replace: "a + b" }, { file: "math.js", find: "slow = true", replace: "slow = false" }] },
  review: { score: 92, verdict: "correct and minimal", findings: [{ severity: "low", file: "math.js", issue: "could add a comment" }] },
});
process.env.ORCH_MOCK_SCRIPT = script;

const base = loadConfig();
const providers = Object.fromEntries(Object.keys(base.providers).map((k) => [k, { enabled: k === "mock" }]));
const cfg = loadConfig({
  vault: path.join(tmp, "vault"),
  worktreeRoot: path.join(tmp, "wt"),
  senior: { model: "mock:senior", fallback: [], timeoutMin: 1 },
  router: { ...base.router, premium: "never" },
  providers: providers as any,
});
// agent profiles come from the real vault
fs.cpSync(path.join(base.vault, "Agents"), path.join(cfg.vault, "Agents"), { recursive: true });

const engine = new Engine(cfg);
engine.vault.saveProject({ name: "demo", repo, baseBranch: "main", allowedCommands: ["node "], linkDirs: [], context: "" });

let s = await engine.start("demo", "add() returns wrong numbers and is slow");
assert.equal(s.status, "waiting", s.error);
assert.equal(s.waiting?.kind, "approval", "high-risk plan must wait for the owner");

s = await engine.resume(s.id, { choice: "approve" });
assert.equal(s.status, "done", s.error);

const [t1, t2] = s.tasks;
assert.equal(t1.status, "accepted");
assert.equal(t2.status, "accepted");
const models = t2.attempts.map((a) => `${a.model}:${a.decision}`);
assert.deepEqual(models, ["mock:a-lazy:retry", "mock:a-lazy:reassign", "mock:b-good:accept"], models.join(", "));
const good = t2.attempts[2];
assert.ok(good.evidence?.checksOk);
const lat = good.evidence!.checks.find((c) => c.name === "latency")!;
assert.equal(lat.baseline, 200);
assert.equal(lat.value, 40);
assert.ok(good.review && good.review.model !== good.model, "reviewer must not be the author");
assert.ok(fs.readFileSync(path.join(engine.vault.runDir(s.id), "logs", `t2-a3.prompt.txt`), "utf8").includes("CONTEXT FROM EARLIER TASKS"), "research report reaches the coder");

// accepted work is on the integration branch, the owner's branch is untouched
assert.match(git(repo, "show", `${s.integrationBranch}:math.js`).out, /a \+ b/);
assert.match(git(repo, "show", "main:math.js").out, /a - b/);
assert.equal(git(repo, "worktree", "list").out.split("\n").length, 1, "worktrees cleaned up");

// the vault learned: execution records, model notes, run + task notes, report
const execs = engine.vault.executions();
assert.ok(execs.some((e) => e.model === "mock:b-good" && e.success));
assert.ok(execs.some((e) => e.model === "mock:a-lazy" && !e.success));
for (const f of ["Models/mock--b-good.md", `Runs/${s.id}/index.md`, `Runs/${s.id}/t2.md`, `Runs/${s.id}/report.md`]) assert.ok(fs.existsSync(engine.vault.p(f)), f);

// the router now prefers the model that delivered
const { candidates } = await engine.router.rank({ category: "coding", mode: "edit", risk: "medium", minTier: "standard", exclude: [], contextNeeded: 1000, budgetUsd: 1, escalated: false });
assert.equal(candidates[0].key, "mock:b-good", JSON.stringify(candidates));

console.log(`e2e PASS (run ${s.id}, vault ${cfg.vault})`);
console.log(fs.readFileSync(engine.vault.p(`Runs/${s.id}/report.md`), "utf8"));
