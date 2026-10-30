// pastLessons: what went wrong in a project's recent runs.
import assert from "node:assert/strict";
import { pastLessons } from "../src/lessons.ts";
import type { RunState, Task } from "../src/types.ts";

const task = (id: string, status: Task["status"], attempts: number, critique?: string): Task => ({
  id, title: `T ${id}`, category: "coding", risk: "low", brief: "", files: [], deps: [], checks: [], status,
  attempts: Array.from({ length: attempts }, (_, i) => ({
    n: i + 1, model: "mock:a", startedAt: "", latencyMs: 0, exitCode: 0, costUsd: 0, tokensIn: 0, tokensOut: 0, reportFile: "", blocked: [],
  })),
  excluded: [], reassigns: 0, ...(critique ? { critique } : {}),
});

const run = (id: string, project: string, createdAt: string, tasks: Task[]): RunState =>
  ({ id, project: { name: project }, createdAt, tasks }) as unknown as RunState;

const older = run("r1", "app", "2026-01-01", [task("t1", "failed", 2, "broke\nagain")]);
const newer = run("r2", "app", "2026-02-01", [
  task("t2", "skipped", 0),
  task("t3", "accepted", 3, "needed a rewrite"),
]);
const other = run("r3", "other", "2026-03-01", [task("t9", "failed", 1)]);
const current = run("r4", "app", "2026-04-01", [task("t8", "failed", 1)]);

const runs = [
  { s: older, report: "## Follow-ups\n- check the docs\n- keep an eye on retries\n\n## Other\n- ignored\n" },
  { s: newer, report: "## Follow-ups\n- not a follow-up\n" },
  { s: other, report: "## Follow-ups\n- other project\n" },
  { s: current, report: "## Follow-ups\n- current run\n" },
];

const lines = pastLessons(runs, "app", "r4");

// other project and the current run are ignored
assert.ok(!lines.some((l) => l.includes("other project")));
assert.ok(!lines.some((l) => l.includes("current run")));
assert.ok(!lines.some((l) => l.includes("t9")));

// newest run first
assert.ok(lines[0].startsWith("r2: "));
assert.ok(lines.some((l) => l.startsWith("r1: ")));

// failed task, critique first line only
assert.ok(lines.includes("r1: task t1 (T t1) failed after 2 attempt(s): broke"));
// skipped task
assert.ok(lines.includes("r2: task t2 (T t2) skipped after 0 attempt(s)"));
// retried then accepted
assert.ok(lines.includes("r2: task t3 (T t3) needed 3 attempts: needed a rewrite"));
// follow-ups of the older run are no longer included
assert.ok(!lines.some((l) => l.includes("check the docs")));
assert.ok(!lines.some((l) => l.includes("keep an eye on retries")));
// follow-ups of the newer run (the newest selected) still are
assert.ok(lines.includes("r2: not a follow-up"));

// max cap
assert.equal(pastLessons(runs, "app", "r4", 5, 2).length, 2);
assert.equal(pastLessons(runs, "app", "r4", 1).length, 3);
// maxRuns keeps only the newest runs
assert.ok(pastLessons(runs, "app", "r4", 1).every((l) => l.startsWith("r2: ")));

console.log("lessons PASS");
