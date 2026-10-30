// The owner's side of a finished run, as commands: one compact summary, and a merge that keeps
// the run's work only if every accepted task's checks still pass on the merged code.
import fs from "node:fs";
import type { Engine } from "./engine.ts";
import { filesOverlap } from "./nodes/flow.ts";
import type { Project, RunState, Task } from "./types.ts";
import { git, shell, tail } from "./util.ts";

/** Everything needed to judge a run in one screen: tasks, evidence, waiting question, diff stat, follow-ups, next step. */
export function runSummary(engine: Engine, s: RunState): string {
  const out: string[] = [];
  const mins = Math.round((Date.parse(s.updatedAt) - Date.parse(s.createdAt)) / 60_000);
  out.push(`run ${s.id}: ${s.status.toUpperCase()}  ${s.tasks.filter((t) => t.status === "accepted").length}/${s.tasks.length} accepted  ${mins} min  $${s.costUsd.toFixed(4)}`);
  out.push(`request: ${s.request.split("\n")[0].slice(0, 160)}`);
  for (const t of s.tasks) {
    const a = t.attempts.find((x) => x.decision === "accept") ?? t.attempts[t.attempts.length - 1];
    const ev = a?.evidence;
    const checks = ev?.checksSkipped
      ? `checks not run (${ev.checksSkipped})`
      : ev?.checks.map((c) => `${c.ok ? "PASS" : "FAIL"} ${c.name}`).join(", ") || "no checks";
    const last = t.attempts[t.attempts.length - 1];
    // a running task's agent may be mid-attempt: no attempt yet, or the last one has no decision
    const who =
      t.status === "running" && !last ? "working (attempt 1)"
      : t.status === "running" && !last.decision ? `${last.model} working (attempt ${t.attempts.length})`
      : a ? `${a.model} (${t.attempts.length} attempt${t.attempts.length > 1 ? "s" : ""}) ${a.decision ?? "-"}`
      : "not started";
    out.push(`  ${t.status.padEnd(9)} ${t.id.padEnd(14)} ${t.category.padEnd(12)} ${t.risk.padEnd(6)} ${who}`);
    if (a) out.push(`      ${checks}${a.review ? `; review ${a.review.score}` : ""}${ev ? `; ${ev.changed.length} file(s)` : ""}${ev?.reverted?.length ? `; undid ${ev.reverted.join(", ")}` : ""}`);
  }
  if (s.waiting) out.push("", `WAITING (${s.waiting.kind}): ${s.waiting.question}`, `answer: orch resume ${s.id} --choice <${s.waiting.options.join("|")}> [--note "..."]`);
  if (s.error) out.push("", `error: ${s.error.split("\n")[0]}`);
  const repo = s.project.repo;
  if (git(repo, "rev-parse", "--verify", "-q", s.integrationBranch).ok) {
    const stat = git(repo, "diff", "--stat", `${s.project.baseBranch}...${s.integrationBranch}`).out;
    if (stat) out.push("", `changes on ${s.integrationBranch}:`, ...stat.split("\n").map((l) => `  ${l}`));
  }
  const report = engine.vault.runDir(s.id) + "/report.md";
  const follow = fs.existsSync(report) ? fs.readFileSync(report, "utf8").split(/^## Follow-ups\s*$/m)[1]?.trim() : "";
  if (follow) out.push("", "follow-ups:", ...follow.split("\n").filter(Boolean).slice(0, 20));
  out.push("", `next: ${nextStep(s)}`);
  return out.join("\n");
}

function nextStep(s: RunState): string {
  if (s.status === "waiting") return `answer the question above (orch resume ${s.id} --choice ...)`;
  if (s.status === "running") return "still running";
  if (s.tasks.some((t) => t.status === "accepted")) return `read the diff (git -C "${s.project.repo}" diff ${s.project.baseBranch}...${s.integrationBranch}), then: orch merge ${s.id}`;
  return "nothing was accepted; read the task notes in the vault and retry or replan";
}

/**
 * Dry run of a preset task batch: what will need the owner's approval, which tasks share files
 * without an order, and which tasks run side by side. Returns the lines and whether the batch is fine.
 */
export function checkBatch(p: Project, tasks: Task[]): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const before = (id: string, seen = new Set<string>()): Set<string> => {
    for (const d of byId.get(id)?.deps ?? []) if (!seen.has(d)) before(d, seen.add(d));
    return seen;
  };
  for (const t of tasks) {
    const notes: string[] = [];
    const outside = t.checks.filter((c) => !p.allowedCommands.some((pre) => c.cmd.trim().startsWith(pre)));
    if (outside.length) notes.push(`needs approval: ${outside.map((c) => c.cmd).join(" ; ")} (allowed: ${p.allowedCommands.join(", ") || "none"})`);
    if (!t.checks.length && t.files.length) notes.push("no checks: nothing proves the change works");
    if (t.brief.length < 200) notes.push(`short brief (${t.brief.length} chars): name the files to read, exact names and what done looks like`);
    const fresh = t.files.filter((f) => !f.endsWith("/") && !fs.existsSync(`${p.repo}/${f}`));
    lines.push(`${t.id} [${t.category}, ${t.risk}] ${t.title}`);
    lines.push(`    files: ${t.files.map((f) => (fresh.includes(f) ? `${f} (new)` : f)).join(", ") || "none (read-only)"}${t.deps.length ? `; after ${t.deps.join(", ")}` : ""}`);
    for (const n of notes) lines.push(`    ! ${n}`);
  }
  for (let i = 0; i < tasks.length; i++)
    for (let j = i + 1; j < tasks.length; j++) {
      const [a, b] = [tasks[i], tasks[j]];
      if (filesOverlap(a.files, b.files) && !before(a.id).has(b.id) && !before(b.id).has(a.id)) {
        ok = false;
        lines.push(`! ${a.id} and ${b.id} change the same files with no order between them: add deps so the second builds on the first`);
      }
    }
  // waves: what can start together once its deps are accepted (file overlaps already ordered above)
  const done = new Set<string>();
  const waves: string[][] = [];
  while (done.size < tasks.length) {
    const wave = tasks.filter((t) => !done.has(t.id) && t.deps.every((d) => done.has(d))).map((t) => t.id);
    if (!wave.length) {
      ok = false;
      lines.push(`! dependency cycle among: ${tasks.filter((t) => !done.has(t.id)).map((t) => t.id).join(", ")}`);
      break;
    }
    waves.push(wave);
    wave.forEach((id) => done.add(id));
  }
  lines.push(`order: ${waves.map((w) => (w.length > 1 ? `[${w.join(" + ")}]` : w[0])).join(" -> ")}  (up to 3 side by side)`);
  return { ok, lines };
}

/**
 * Merges orch/<run> into the project's base branch without committing, runs every accepted task's
 * checks on the merged tree, and commits only when all pass (otherwise the merge is undone).
 * The owner's branch must be checked out and clean. Never pushes.
 */
export async function mergeRun(s: RunState, o: { test: boolean; log: (l: string) => void }): Promise<{ ok: boolean; commit?: string }> {
  const { repo, baseBranch } = s.project;
  const fail = (msg: string) => {
    o.log(msg);
    return { ok: false };
  };
  if (s.status === "running" || s.status === "waiting") return fail(`run ${s.id} is ${s.status}; finish it first`);
  const accepted = s.tasks.filter((t) => t.status === "accepted");
  if (!accepted.length) return fail("no accepted tasks to merge");
  if (!git(repo, "rev-parse", "--verify", "-q", s.integrationBranch).ok) return fail(`branch ${s.integrationBranch} does not exist in ${repo}`);
  const head = git(repo, "rev-parse", "--abbrev-ref", "HEAD").out;
  if (head !== baseBranch) return fail(`${repo} is on ${head}; check out ${baseBranch} first`);
  if (!git(repo, "diff", "--quiet").ok || !git(repo, "diff", "--cached", "--quiet").ok) return fail(`${repo} has uncommitted changes; commit or stash them first`);
  if (git(repo, "merge-base", "--is-ancestor", s.integrationBranch, "HEAD").ok) return fail(`${s.integrationBranch} is already merged into ${baseBranch}`);

  const m = git(repo, "merge", "--no-ff", "--no-commit", s.integrationBranch);
  if (!m.ok) {
    git(repo, "merge", "--abort");
    return fail(`merge conflict, nothing changed:\n${m.out || m.err}`);
  }
  o.log(`merged ${s.integrationBranch} into ${baseBranch} (not committed yet):\n${git(repo, "diff", "--cached", "--stat").out}`);

  if (o.test) {
    const cmds = [...new Set(accepted.flatMap((t) => t.checks.map((c) => c.cmd)))];
    for (const cmd of cmds) {
      const r = await shell(cmd, { cwd: repo, timeoutMs: 15 * 60_000 });
      o.log(`${r.code === 0 ? "PASS" : "FAIL"} ${cmd}`);
      if (r.code !== 0) {
        git(repo, "merge", "--abort");
        return fail(`check failed on the merged code, merge undone:\n${tail(r.out, 30)}`);
      }
    }
    if (!cmds.length) o.log("no checks to run");
  }
  const body = accepted.map((t) => `- ${t.id}: ${t.title}`).join("\n");
  const c = git(repo, "commit", "-q", "-m", `Merge ${s.integrationBranch}: ${s.request.split("\n")[0].slice(0, 72)}`, "-m", `Accepted tasks:\n${body}\n\nRun ${s.id}, merged by orch merge after the checks passed.`);
  if (!c.ok) {
    git(repo, "merge", "--abort");
    return fail(`commit failed, merge undone: ${c.err}`);
  }
  const commit = git(repo, "rev-parse", "--short", "HEAD").out;
  o.log(`committed ${commit} on ${baseBranch} (not pushed)`);
  return { ok: true, commit };
}
