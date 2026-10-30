// Parallel tasks with the mock provider: p1 and p2 share no files and run side by side;
// p3 touches p1's file, so it waits for p1; p4 depends on p2. Everything lands on the
// integration branch and the worktrees are cleaned up.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.ts";
import { Engine } from "../src/engine.ts";
import { filesOverlap } from "../src/nodes/flow.ts";
import { git, writeJson } from "../src/util.ts";

assert.ok(filesOverlap(["src/a.ts"], ["src/a.ts"]));
assert.ok(filesOverlap(["src/"], ["src/a.ts"]));
assert.ok(!filesOverlap(["src/a.ts"], ["src/b.ts"]));
assert.ok(!filesOverlap([], ["src/a.ts"]));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-par-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);
fs.writeFileSync(path.join(repo, "a.js"), "A=1\n");
fs.writeFileSync(path.join(repo, "b.js"), "B=1\n");
fs.writeFileSync(path.join(repo, "c.js"), "C=1\n");
git(repo, "init", "-q", "-b", "main");
git(repo, "add", ".");
git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");

const task = (id: string, files: string[], deps: string[] = []) => ({ id, title: `edit ${files.join(", ")}`, category: "coding", risk: "low", brief: "edit", files, deps, checks: [] });
const script = path.join(tmp, "mock.json");
writeJson(script, {
  models: [
    { model: "senior", tier: "premium" },
    { model: "coder", tier: "strong" },
  ],
  understand: { goal: "edit files", constraints: [], successCriteria: [], assumptions: [], questions: [] },
  plan: { tasks: [task("p1", ["a.js"]), task("p2", ["b.js"]), task("p3", ["a.js"]), task("p4", ["c.js"], ["p2"])] },
  // p3 runs on top of p1's change, so its edit only matches after p1 was integrated
  edits: { coder: [{ file: "a.js", find: "A=2", replace: "A=3" }, { file: "a.js", find: "A=1", replace: "A=2" }, { file: "b.js", find: "B=1", replace: "B=2" }, { file: "c.js", find: "C=1", replace: "C=2" }] },
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
engine.vault.saveProject({ name: "demo", repo, baseBranch: "main", allowedCommands: [], linkDirs: [], context: "" });

const s = await engine.start("demo", "edit the files");
assert.equal(s.status, "done", s.error);
assert.deepEqual(s.tasks.map((t) => `${t.id}:${t.status}`), ["p1:accepted", "p2:accepted", "p3:accepted", "p4:accepted"]);
assert.equal(s.lanes, undefined, "lanes cleared when the tasks are done");

const starts = fs
  .readFileSync(path.join(engine.vault.runDir(s.id), "events.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((e) => e.type === "log" && /^task p\d:/.test(e.msg))
  .map((e) => e.msg as string);
assert.ok(starts.some((m) => m.startsWith("task p2:") && m.includes("alongside p1")), `p2 runs next to p1:\n${starts.join("\n")}`);
const p3 = starts.find((m) => m.startsWith("task p3:"))!;
assert.ok(!p3.includes("p1"), `p3 shares a.js with p1 and must wait for it: ${p3}`);
assert.ok(starts.indexOf(starts.find((m) => m.startsWith("task p4:"))!) > starts.indexOf(starts.find((m) => m.startsWith("task p2:"))!), "p4 starts after its dependency");

const prompt = fs.readFileSync(path.join(engine.vault.runDir(s.id), "logs", "p1-a1.prompt.txt"), "utf8");
assert.match(prompt, /OTHER TASKS IN THIS RUN[\s\S]*- p2: edit b\.js \(files: b\.js\)/, "each worker knows what the others do");
assert.ok(!/- p1: /.test(prompt.split("OTHER TASKS IN THIS RUN")[1]), "a task is not listed as its own sibling");

for (const [file, want] of [["a.js", "A=3"], ["b.js", "B=2"], ["c.js", "C=2"]]) assert.match(git(repo, "show", `${s.integrationBranch}:${file}`).out, new RegExp(want), file);
assert.equal(git(repo, "worktree", "list").out.split("\n").length, 1, "worktrees cleaned up");

// a task that needs the owner waits alone: its neighbour still finishes, then the run asks
writeJson(script, {
  ...JSON.parse(fs.readFileSync(script, "utf8")),
  plan: { tasks: [task("q1", ["d.js"]), task("q2", ["b.js"])] }, // nobody can change d.js: q1 ends in an escalation
});
let w = await engine.start("demo", "one task gets stuck");
assert.equal(w.status, "waiting", w.error);
assert.equal(w.waiting?.kind, "escalation");
assert.equal(w.waiting?.taskId, "q1");
assert.equal(w.tasks.find((t) => t.id === "q2")?.status, "accepted", "q2 finished while q1 was stuck");
assert.deepEqual(w.lanes?.map((l) => `${l.task}:${l.state}`), ["q1:waiting"]);
w = await engine.resume(w.id, { choice: "skip" });
assert.equal(w.status, "done", w.error);
assert.equal(w.tasks.find((t) => t.id === "q1")?.status, "skipped");
assert.match(git(repo, "show", `${w.integrationBranch}:b.js`).out, /B=2/);

console.log(`parallel PASS (runs ${s.id}, ${w.id})`);
