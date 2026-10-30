// Git isolation: one integration branch per run, one branch + worktree per task.
// Agents never touch the owner's checkout; accepted work is merged into the
// integration branch, which the owner reviews and merges.
import fs from "node:fs";
import path from "node:path";
import type { Project, RunState, Task } from "./types.ts";
import { git, inScope, posix } from "./util.ts";
import { REPORT_NAME } from "./adapters/common.ts";

/**
 * Added and removed lines in a unified diff. Only the "+++ " / "--- " file headers are skipped: the old
 * rule (second character not + or -) dropped a real added Markdown list item ("+- [x](./x)"), so a
 * correct one-line edit looked like no change and was retried four times (Express run 2026-10-22).
 */
export function countDiffLines(diff: string): number {
  // headers name the file ("--- a/x", "+++ b/x", "/dev/null"); a removed "-- comment" line is content
  return diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) (a\/|b\/|\/dev\/null)/.test(l)).length;
}

const ID = ["-c", "user.name=orchestrator", "-c", "user.email=orchestrator@local"];

export class Workspace {
  private root: string;
  constructor(worktreeRoot: string) {
    this.root = worktreeRoot;
  }

  private dir(run: string, name: string) {
    return path.join(this.root, run, name);
  }

  /** Creates orch/<run> from the base branch and a worktree for merging into it. */
  ensureIntegration(s: RunState) {
    if (s.integrationWorktree && fs.existsSync(s.integrationWorktree)) return;
    const repo = s.project.repo;
    const wt = this.dir(s.id, "_integration");
    fs.mkdirSync(path.dirname(wt), { recursive: true });
    const exists = git(repo, "rev-parse", "--verify", "--quiet", s.integrationBranch).ok;
    const r = exists ? git(repo, "worktree", "add", wt, s.integrationBranch) : git(repo, "worktree", "add", "-b", s.integrationBranch, wt, s.project.baseBranch);
    if (!r.ok) throw new Error(`integration worktree: ${r.err}`);
    s.integrationWorktree = wt;
  }

  /** Fresh branch + worktree for a task, starting from the integration branch (so it sees accepted deps). */
  createTask(s: RunState, t: Task) {
    if (t.worktree && fs.existsSync(t.worktree)) return;
    const repo = s.project.repo;
    const wt = this.dir(s.id, t.id);
    t.branch = `${s.integrationBranch}--${t.id}`;
    git(repo, "branch", "-D", t.branch);
    const r = git(repo, "worktree", "add", "-b", t.branch, wt, s.integrationBranch);
    if (!r.ok) throw new Error(`task worktree: ${r.err}`);
    t.worktree = wt;
    this.link(s.project, wt);
  }

  /** Shares heavy folders (node_modules, .venv) by junction instead of installing. */
  private link(p: Project, wt: string) {
    for (const d of p.linkDirs) {
      const target = path.join(p.repo, d);
      const link = path.join(wt, d);
      if (!fs.existsSync(target) || fs.existsSync(link)) continue;
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(target, link, "junction");
    }
  }
  /** Junctions must go BEFORE the worktree is deleted, or deleting walks into the real folder. */
  private unlink(p: Project, wt: string) {
    for (const d of p.linkDirs) {
      const link = path.join(wt, d);
      try {
        if (fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
      } catch {
        /* not there */
      }
    }
  }

  /** Throws away the agent's uncommitted work (new model starts clean). */
  /** Back to the task's start point. git clean drops linked folders the project does not ignore, so they are linked again. */
  reset(t: Task, p?: Project) {
    if (!t.worktree) return;
    git(t.worktree, "reset", "--hard", "-q");
    git(t.worktree, "clean", "-fdq", "-e", REPORT_NAME);
    if (p) this.link(p, t.worktree);
  }

  /** Changed files vs the task's start point, with scope, plus the full diff written to diffFile. */
  changes(s: RunState, t: Task, diffFile: string) {
    const wt = t.worktree!;
    git(wt, "add", "-A", "--", ".", ...s.project.linkDirs.map((d) => `:!${d}`));
    const names = git(wt, "diff", "--cached", "--name-status", "--no-renames", "HEAD").out.split("\n").filter(Boolean);
    const changed = names.map((l) => {
      const [status, ...rest] = l.split("\t");
      const file = posix(rest[rest.length - 1]);
      return { file, status, inScope: inScope(file, t.files) };
    });
    const diff = git(wt, "diff", "--cached", "HEAD").out;
    fs.writeFileSync(diffFile, diff + "\n");
    const diffLines = countDiffLines(diff);
    git(wt, "reset", "-q");
    return { changed, diff, diffLines };
  }

  /** Undoes the agent's changes to these files only: added files go, changed or deleted ones come back from the start point. */
  revert(t: Task, files: { file: string; status: string }[]) {
    const wt = t.worktree!;
    const restore = files.filter((f) => !f.status.startsWith("A")).map((f) => f.file);
    if (restore.length) git(wt, "checkout", "HEAD", "--", ...restore);
    for (const f of files.filter((x) => x.status.startsWith("A"))) fs.rmSync(path.join(wt, f.file), { force: true });
  }

  /** Commits the task branch and merges it into the integration branch. */
  integrate(s: RunState, t: Task): { ok: boolean; err?: string } {
    const wt = t.worktree!;
    git(wt, "add", "-A", "--", ".", ...s.project.linkDirs.map((d) => `:!${d}`));
    const staged = git(wt, "diff", "--cached", "--quiet").ok === false;
    if (staged) {
      const c = git(wt, ...ID, "commit", "-q", "-m", `${t.id}: ${t.title}`, "-m", `Run ${s.id}, task ${t.id}, accepted by the orchestrator.`);
      if (!c.ok) return { ok: false, err: c.err };
    }
    this.ensureIntegration(s);
    const m = git(s.integrationWorktree!, ...ID, "merge", "--no-ff", "-q", "-m", `merge ${t.id}: ${t.title}`, t.branch!);
    if (!m.ok) {
      git(s.integrationWorktree!, "merge", "--abort");
      return { ok: false, err: m.err || m.out };
    }
    this.removeTask(s, t);
    return { ok: true };
  }

  removeTask(s: RunState, t: Task) {
    if (!t.worktree || !fs.existsSync(t.worktree)) return;
    this.unlink(s.project, t.worktree);
    git(s.project.repo, "worktree", "remove", "--force", t.worktree);
    git(s.project.repo, "worktree", "prune");
  }

  removeIntegration(s: RunState) {
    if (s.integrationWorktree && fs.existsSync(s.integrationWorktree)) {
      git(s.project.repo, "worktree", "remove", "--force", s.integrationWorktree);
      git(s.project.repo, "worktree", "prune");
    }
    // the run's folder under worktreeRoot is empty once every worktree is gone
    const dir = path.join(this.root, s.id);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }
}
