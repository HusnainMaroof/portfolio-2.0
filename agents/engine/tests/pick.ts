// pickReady: dependency handling without running anything.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classify } from "../src/adapters/common.ts";
import { countDiffLines } from "../src/workspace.ts";
import { pickReady, ownFollowUps } from "../src/nodes/flow.ts";
import type { RunState, Task } from "../src/types.ts";
import { git, shell, watchWindow, type WatchInfo } from "../src/util.ts";

const task = (id: string, deps: string[] = [], status: Task["status"] = "pending"): Task => ({
  id, title: id, category: "coding", risk: "low", brief: "", files: [], deps, checks: [], status, attempts: [], excluded: [], reassigns: 0,
});
const run = (tasks: Task[]) => ({ tasks }) as unknown as RunState;
const logs: string[] = [];
const log = (m: string) => logs.push(m);

// ready task with accepted deps is picked
let s = run([task("a", [], "accepted"), task("b", ["a"])]);
assert.equal(pickReady(s, () => true, log)?.id, "b");

// a cycle (c <-> d) with nothing running: both are skipped instead of hanging
s = run([task("c", ["d"]), task("d", ["c"])]);
assert.equal(pickReady(s, () => true, log), undefined);
assert.deepEqual(s.tasks.map((t) => t.status), ["skipped", "skipped"]);
assert.ok(logs.some((l) => l.includes("can never be accepted")));

// while another task is still running, waiting tasks are left alone
s = run([task("e", [], "running"), task("f", ["e"])]);
assert.equal(pickReady(s, () => true, log), undefined);
assert.equal(s.tasks[1].status, "pending");

// a GIT_DIR leaked from an agent shell must not break the engine's git
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-git-env-"));
git(tmp, "init", "-q");
process.env.GIT_DIR = "/nonexistent";
assert.equal(git(tmp, "rev-parse", "--git-dir").ok, true, "git ignores a leaked GIT_DIR");
delete process.env.GIT_DIR;
fs.rmSync(tmp, { recursive: true, force: true });

// a leaked GIT_DIR must not break shell() commands, but an explicit env must still win
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "orch-shell-env-"));
git(tmp2, "init", "-q");
process.env.GIT_DIR = "/nonexistent";
const r1 = await shell("git rev-parse --git-dir", { cwd: tmp2, timeoutMs: 30_000 });
assert.equal(r1.code, 0, "shell ignores a leaked GIT_DIR");
const r2 = await shell("echo $GIT_DIR", { cwd: tmp2, timeoutMs: 30_000, env: { GIT_DIR: "/x" } });
assert.equal(r2.out.trim(), "/x", "an explicit env wins over the filter");
delete process.env.GIT_DIR;
fs.rmSync(tmp2, { recursive: true, force: true });

assert.deepEqual(ownFollowUps(["owned by task t4", "`t4` sets the script", "t40 is fine", "add a cache"], ["t4"]), ["t40 is fine", "add a cache"]);

// failure classes from real 2026-10-22 runs: a retired free model, and cline over ACP hiding that error
assert.equal(classify('404: The free launch period for MiniMax M3.1 Flash ended on Oct 22, 2026. The `:free` variant has been retired', 0, false, 7_000, false), "not_found");
assert.equal(classify('error: no response from ACP server (the backend may not serve this model)', 1, false, 6_000, false), "no_response");
assert.equal(classify('', 1, false, 6_000, false), "crash", "an empty quick exit without the marker stays a crash");

// the supervisor's check-in: a window that only repeats earlier lines is a loop (numbers masked),
// heartbeats are not progress, new lines are
const seen = new Set<string>();
const restate = Array.from({ length: 12 }, (_, i) => `Question restated: which port does the server bind, step ${i}`).join("\n");
assert.equal(watchWindow(restate, seen).verdict, "ok", "the first window has nothing to repeat");
assert.equal(watchWindow(restate, seen).verdict, "looping");
assert.equal(watchWindow("[heartbeat] session open, 12 min\n[heartbeat] session open, 13 min", seen).verdict, "no progress");
assert.equal(watchWindow("read src/config.js\nedited src/server.js line 4", seen).verdict, "ok");

// and through shell(): a looping agent and a heartbeat-only agent are stopped, a working one is not
const watched = async (script: string) => {
  const ws: WatchInfo[] = [];
  const r = await shell(script, { cwd: os.tmpdir(), timeoutMs: 20_000, watchMs: 1_500, onWatch: (w) => ws.push(w) });
  return { r, ws };
};
const loop = await watched("while true; do echo 'Question restated: which port does it bind'; sleep 0.05; done");
assert.ok(loop.r.stalled && /stopped by the watch: looping/.test(loop.r.out), loop.r.out.slice(-200));
const quiet = await watched("while true; do echo '[heartbeat] still here'; sleep 0.2; done");
assert.ok(quiet.r.stalled && /no progress/.test(quiet.r.out), quiet.r.out.slice(-200));
const busy = await watched("for i in 1 2 3; do echo \"reading file number $i of the project\"; sleep 0.1; done");
assert.equal(busy.r.stalled, false);
assert.equal(busy.r.code, 0);

// changed lines: a real added list item ("+- [x]") and a removed "-- comment" count, file headers do not
const listDiff = [
  "diff --git a/examples/README.md b/examples/README.md",
  "--- a/examples/README.md",
  "+++ b/examples/README.md",
  "@@ -16,6 +16,7 @@",
  " - [params](./params) - Working with route parameters",
  "+- [problem-json](./problem-json) - Responding with RFC 9457 problem details",
  "--- old SQL comment",
  "--- /dev/null",
].join("\n");
assert.equal(countDiffLines(listDiff), 2);

console.log("pick PASS");
