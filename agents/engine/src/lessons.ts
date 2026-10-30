// What went wrong in a project's recent runs: failed tasks, retried tasks and follow-ups.
import { followUps } from "./nodes/flow.ts";
import type { RunState, Task } from "./types.ts";

function clip(text: string, max = 200): string {
  const one = text.split("\n")[0].trim();
  return one.length > max ? one.slice(0, max) : one;
}

function critiquePart(task: Task): string {
  return task.critique ? `: ${clip(task.critique)}` : "";
}

export function pastLessons(
  runs: { s: RunState; report: string }[],
  project: string,
  currentId: string,
  maxRuns = 5,
  max = 15,
): string[] {
  const mine = runs
    .filter((r) => r.s.project.name === project && r.s.id !== currentId)
    .sort((a, b) => (a.s.createdAt < b.s.createdAt ? 1 : a.s.createdAt > b.s.createdAt ? -1 : 0))
    .slice(0, maxRuns);
  const out: string[] = [];
  for (const [i, { s, report }] of mine.entries()) {
    const prefix = `${s.id}: `;
    for (const task of s.tasks) {
      if (task.status === "failed" || task.status === "skipped") {
        const n = task.attempts.length;
        out.push(`${prefix}task ${task.id} (${task.title}) ${task.status} after ${n} attempt(s)${critiquePart(task)}`);
      } else if (task.status === "accepted" && task.attempts.length > 1) {
        out.push(`${prefix}task ${task.id} (${task.title}) needed ${task.attempts.length} attempts${critiquePart(task)}`);
      }
    }
    // follow-ups only from the newest selected run (index 0); older runs' follow-ups may be stale
    if (i === 0) {
      for (const f of followUps(report)) {
        out.push(`${prefix}${clip(f)}`);
      }
    }
  }
  return out.slice(0, max);
}
