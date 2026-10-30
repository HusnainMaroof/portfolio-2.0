// Guards against what real agents do (found in real runs): "BLOCKED: none", BLOCKED about the
// report file, BLOCKED for another task's work, and stray files outside the allowed list.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.ts";
import { Engine } from "../src/engine.ts";
import { blockedLines } from "../src/nodes/agent.ts";
import { arr, questionChoices } from "../src/nodes/senior.ts";
import { mergeRun, runSummary } from "../src/ship.ts";
import { git, writeJson } from "../src/util.ts";

for (const l of ["BLOCKED: none.", "- BLOCKED: none — finding established.", "**BLOCKED:** none", "BLOCKED: N/A", "BLOCKED: no", "BLOCKED: cannot write `.orch-report.md` — plan mode"])
  assert.deepEqual(blockedLines(l), [], l);
for (const l of ["BLOCKED: a dependency must change", "BLOCKED: no access to the staging database"]) assert.equal(blockedLines(l).length, 1, l);

// a senior question given as an object (real run) reads as text, not "[object Object]"
const q = arr([{ question: "Node 24 only?", whyBlocking: "two designs", options: ["yes", "no"] }, "plain", { x: 1 }]);
assert.equal(q[0], "Node 24 only? (why it matters: two designs) Options: (1) yes (2) no");
assert.deepEqual(q.slice(1), ["plain", '{"x":1}']);

// questionChoices extracts numbered choices from first question's options
assert.deepEqual(questionChoices([{ question: "q", options: ["a", "b"] }]), ["1", "2"]);
assert.deepEqual(questionChoices(["plain"]), []);
assert.deepEqual(questionChoices(undefined), []);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-guards-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);
fs.writeFileSync(path.join(repo, "a.js"), "module.exports = 1;\n");
fs.writeFileSync(path.join(repo, "check.js"), "if (require('./a.js') !== 2) { console.error('want 2'); process.exit(1); }\n");
git(repo, "init", "-q", "-b", "main");
git(repo, "add", ".");
git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");

const script = path.join(tmp, "mock.json");
writeJson(script, {
  models: [
    { model: "senior", tier: "premium" },
    { model: "coder", tier: "strong" },
  ],
  understand: { goal: "a.js exports 2", constraints: [], successCriteria: [], assumptions: [], questions: [] },
  plan: { tasks: [{ id: "g1", title: "export 2", category: "coding", risk: "low", brief: "make a.js export 2", files: ["a.js"], deps: [], checks: [{ name: "check", cmd: "node check.js" }] }] },
  edits: { coder: [{ file: "a.js", find: "= 1", replace: "= 2" }] },
  stray: { coder: [{ file: "notes.txt", content: "scratch\n" }] },
  say: { coder: "\nBLOCKED: did not update check.js, it is outside ALLOWED FILES\n" },
  review: { score: 90, verdict: "ok", findings: [] },
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
fs.cpSync(path.join(base.vault, "Agents"), path.join(cfg.vault, "Agents"), { recursive: true });
const engine = new Engine(cfg);
engine.vault.saveProject({ name: "demo", repo, baseBranch: "main", allowedCommands: ["node "], linkDirs: [], context: "" });

const s = await engine.start("demo", "make a.js export 2");
assert.equal(s.status, "done", s.error);
const t = s.tasks[0];
assert.equal(t.status, "accepted", "checks pass, so a BLOCKED line about other work does not stop the task");
const a = t.attempts[0];
assert.equal(t.attempts.length, 1, "the stray file did not cost a retry");
assert.deepEqual(a.evidence?.reverted, ["notes.txt"]);
assert.ok(a.evidence?.scopeOk);
assert.match(git(repo, "show", `${s.integrationBranch}:a.js`).out, /= 2/);
assert.equal(git(repo, "cat-file", "-e", `${s.integrationBranch}:notes.txt`).ok, false, "stray file never reaches the integration branch");
const report = fs.readFileSync(engine.vault.p(`Runs/${s.id}/report.md`), "utf8");
assert.match(report, /g1\*\* \(agent, left undone\): did not update check\.js/);
assert.match(report, /g1\*\* \(engine\): undid out-of-scope edits to `notes\.txt`/);

// owner side: one-screen summary, then a merge that commits only when the checks pass on the merged code
const sum = runSummary(engine, s);
assert.match(sum, /DONE {2}1\/1 accepted/);
assert.match(sum, /undid notes\.txt/);
assert.match(sum, /next: .*orch merge /);
const logs: string[] = [];
fs.writeFileSync(path.join(repo, "check.js"), "process.exit(1);\n"); // dirty tree: refused before touching anything
assert.equal((await mergeRun(s, { test: true, log: (l) => logs.push(l) })).ok, false);
assert.match(logs.at(-1)!, /uncommitted changes/);
git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "owner breaks the check on main");
assert.equal((await mergeRun(s, { test: true, log: (l) => logs.push(l) })).ok, false, "failing check on the merged code");
assert.match(logs.at(-1)!, /check failed on the merged code, merge undone/);
assert.equal(git(repo, "status", "--porcelain").out, "", "merge undone, tree clean");
git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "revert", "--no-edit", "HEAD");
const merged = await mergeRun(s, { test: true, log: (l) => logs.push(l) });
assert.ok(merged.ok, logs.join("\n"));
assert.match(git(repo, "show", "main:a.js").out, /= 2/);
assert.equal((await mergeRun(s, { test: true, log: (l) => logs.push(l) })).ok, false);
assert.match(logs.at(-1)!, /already merged/);

console.log(`guards PASS (run ${s.id})`);
