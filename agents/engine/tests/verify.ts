// Evidence: when every change is outside ALLOWED FILES the checks must not run, so the log cannot
// read like a pass on the stray files (real run: "scope VIOLATED, checks 1/1").
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.ts";
import { Engine } from "../src/engine.ts";
import { git, writeJson } from "../src/util.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-verify-"));
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
  plan: { tasks: [{ id: "v1", title: "export 2", category: "coding", risk: "low", brief: "make a.js export 2", files: ["a.js"], deps: [], checks: [{ name: "check", cmd: "node check.js" }] }] },
  edits: { coder: [] },
  stray: { coder: [{ file: "notes.txt", content: "scratch\n" }] },
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
const t = s.tasks[0];
assert.notEqual(t.status, "accepted", "work that is only outside ALLOWED FILES is never accepted");
const a = t.attempts[t.attempts.length - 1];
assert.equal(a.evidence?.scopeOk, false);
assert.equal(a.evidence?.checks.length, 0, "no checks run on out-of-scope changes");
assert.match(a.evidence?.checksSkipped ?? "", /outside ALLOWED FILES/);
const events = fs.readFileSync(engine.vault.p(`Runs/${s.id}/events.jsonl`), "utf8");
assert.match(events, /scope VIOLATED, checks not run \(every change is outside ALLOWED FILES\)/);

console.log("verify PASS");
