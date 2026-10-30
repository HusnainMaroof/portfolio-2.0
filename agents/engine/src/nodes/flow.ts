// Flow-control and human-in-the-loop nodes.
import fs from "node:fs";
import path from "node:path";
import type { NodeType } from "./index.ts";
import { WAIT, type RunState, type Task } from "../types.ts";
import { modelLink } from "../vault.ts";
import { buildCodeGraph } from "../graph.ts";
import { commandExists, git } from "../util.ts";

/** Bullet lines under the report's "## Follow-ups" heading (until the next heading); "none" entries dropped. */
export function followUps(report: string): string[] {
  const m = report.match(/^##\s*Follow-ups?\s*$([\s\S]*?)(?=^#{1,2}\s|(?![\s\S]))/im);
  if (!m) return [];
  const items: string[] = [];
  for (const line of m[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("```")) continue;
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) items.push(bullet[1].trim());
    else if (items.length) items[items.length - 1] += " " + line.trim(); // wrapped bullet
    else items.push(line.trim());
  }
  // "None." / "None. x verified" are not follow-ups; "None of the callers handle x" is
  return items.filter((l) => !/^(none|n\/a|nothing)(\s*[.!:;,—–-]|$)/i.test(l));
}

/** Drop follow-up items that mention another task's id as a whole word (also inside backticks): that work is the other task's. */
export function ownFollowUps(items: string[], otherIds: string[]): string[] {
  if (!otherIds.length) return items.slice();
  const escaped = otherIds.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<!\\w)(?:${escaped.join("|")})(?!\\w)`);
  return items.filter((item) => !re.test(item));
}

/** Skips tasks whose dependencies failed, then returns the first pending task whose dependencies are accepted and that `free` allows. */
export function pickReady(s: RunState, free: (t: Task) => boolean, log: (msg: string) => void): Task | undefined {
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of s.tasks.filter((x) => x.status === "pending")) {
      const dead = t.deps.filter((d) => ["failed", "skipped"].includes(s.tasks.find((x) => x.id === d)?.status ?? ""));
      if (dead.length) {
        t.status = "skipped";
        log(`skip ${t.id}: dependency ${dead.join(", ")} did not finish`);
        changed = true;
      }
    }
  }
  const next = s.tasks.find((t) => t.status === "pending" && t.deps.every((d) => s.tasks.find((x) => x.id === d)?.status === "accepted") && free(t));
  if (!next && !s.tasks.some((t) => t.status === "running")) {
    // nothing runs and nothing is ready: the pending tasks depend on a task that failed or was
    // skipped, or on each other (a cycle), so they can never start; skip them instead of hanging
    for (const t of s.tasks.filter((x) => x.status === "pending")) {
      t.status = "skipped";
      log(`skip ${t.id}: its dependencies ${t.deps.join(", ")} can never be accepted (failed, skipped or circular)`);
    }
  }
  return next;
}

/** True when two tasks may touch the same file (folders end with "/"). */
export function filesOverlap(a: string[], b: string[]): boolean {
  const hit = (x: string, y: string) => x === y || (x.endsWith("/") && y.startsWith(x));
  return a.some((x) => b.some((y) => hit(x, y) || hit(y, x)));
}

export const flowNodes: NodeType[] = [
  {
    type: "context.codemap",
    label: "Code map (Graphify)",
    group: "flow",
    description: "Refreshes the project's Graphify code map in vault/Code/<project> (AST only, no tokens) so the senior plans from an up-to-date picture. Skips when Graphify is not installed.",
    ports: ["out"],
    params: [{ name: "when", type: "select", options: ["stale", "always", "never"], default: "stale", description: "Rebuild only when the repo has new commits, every run, or never." }],
    async run({ engine, s, params, log }) {
      if (params.when === "never") return "out";
      if (!commandExists(engine.cfg.graphify.command)) {
        log("code map skipped: Graphify not installed (pip install graphifyy)");
        return "out";
      }
      const dir = engine.vault.p("Code", s.project.name);
      const report = path.join(dir, "GRAPH_REPORT.md");
      const built = fs.existsSync(report) ? fs.readFileSync(report, "utf8").match(/Built from commit: `([0-9a-f]+)`/)?.[1] : undefined;
      const head = git(s.project.repo, "rev-parse", "HEAD").out;
      if (params.when === "stale" && built && head.startsWith(built)) return "out";
      const g = await buildCodeGraph(s.project, dir, engine.cfg.graphify.command);
      log(`code map: ${g.summary}`);
      return "out";
    },
  },
  {
    type: "human.approval",
    label: "Owner approval",
    group: "human",
    description: "Pauses for the owner when the plan has high-risk tasks or check commands outside the allow-list (or always, if set).",
    ports: ["approved", "rejected"],
    params: [{ name: "always", type: "boolean", default: false, description: "Always ask, even for low-risk plans." }],
    async run({ s, params }) {
      if (s.input && s.waiting?.kind === "approval") {
        const ok = s.input.choice === "approve";
        s.waiting = undefined;
        s.input = undefined;
        // approved: these reasons are answered; left set they would be reported as the reason of a later escalation
        if (ok) for (const t of s.tasks) t.approvalReason = undefined;
        return ok ? "approved" : "rejected";
      }
      const risky = s.tasks.filter((t) => t.approvalReason);
      if (!risky.length && !params.always) return "approved";
      const lines = s.tasks.map((t) => `- ${t.id} [${t.category}, ${t.risk}] ${t.title}${t.approvalReason ? ` <- ${t.approvalReason}` : ""}\n    checks: ${t.checks.map((c) => c.cmd).join(" ; ") || "none"}`);
      s.waiting = { kind: "approval", question: `Approve this plan?\n${lines.join("\n")}`, options: ["approve", "reject"] };
      return WAIT;
    },
  },
  {
    type: "tasks.next",
    label: "Next task",
    group: "flow",
    description: "Picks the next pending task whose dependencies are accepted (loop port 'task'); 'done' when none are left. Tasks whose dependencies failed are skipped.",
    ports: ["task", "done"],
    params: [{ name: "parallel", type: "number", default: 3, description: "Tasks run side by side when they share no files and no unfinished dependencies. 1 = one at a time." }],
    async run({ s, log }) {
      const next = pickReady(s, () => true, log);
      if (!next) {
        s.currentTask = undefined;
        return "done";
      }
      next.status = "running";
      s.currentTask = next.id;
      log(`task ${next.id}: ${next.title}`);
      return "task";
    },
  },
  {
    type: "human.escalation",
    label: "Escalate to owner",
    group: "human",
    description: "Pauses the run and asks the owner to decide a task the team could not finish: accept as is, retry, reassign, skip, or abort the run.",
    ports: ["accept", "retry", "reassign", "skip", "abort"],
    params: [],
    async run({ s, task }) {
      const t = task();
      const a = t.attempts[t.attempts.length - 1];
      if (s.input && s.waiting?.kind === "escalation") {
        const choice = s.input.choice;
        if (s.input.note) t.critique = s.input.note;
        if (a && choice === "retry") a.decision = "retry";
        if (a && choice === "reassign" && !t.excluded.includes(a.model)) t.excluded.push(a.model);
        if (choice === "accept") t.status = "accepted";
        if (choice === "abort") s.status = "aborted";
        s.waiting = undefined;
        s.input = undefined;
        return choice;
      }
      const why = t.approvalReason || a?.reason || "no model available";
      s.waiting = {
        kind: "escalation",
        taskId: t.id,
        question: `Task ${t.id} "${t.title}" needs you: ${why}.${a ? ` Last attempt ${a.n} by ${a.model}.` : ""} See Runs/${s.id}/${t.id}.md`,
        options: ["accept", "retry", "reassign", "skip", "abort"],
      };
      t.approvalReason = undefined;
      return WAIT;
    },
  },
  {
    type: "task.close",
    label: "Close task",
    group: "flow",
    description: "Marks the current task skipped or failed and cleans up its worktree.",
    ports: ["out"],
    params: [{ name: "status", type: "select", options: ["skipped", "failed"], default: "skipped", description: "Final status." }],
    async run({ engine, s, params, task }) {
      const t = task();
      t.status = params.status as "skipped" | "failed";
      engine.ws.removeTask(s, t);
      return "out";
    },
  },
  {
    type: "report.final",
    label: "Final report",
    group: "output",
    description: "Writes the run report to the vault (what was done, by which model, evidence, cost) and ends the run.",
    ports: [],
    params: [],
    async run({ engine, s }) {
      if (s.status === "running") s.status = "done";
      engine.ws.removeIntegration(s);
      const rows = s.tasks.map((t) => {
        const a = t.attempts.find((x) => x.decision === "accept") ?? t.attempts[t.attempts.length - 1];
        const checks = a?.evidence?.checks.map((c) => `${c.ok ? "PASS" : "FAIL"} ${c.name}${c.value !== undefined ? ` ${c.baseline ?? "?"} -> ${c.value}` : ""}`).join("; ") || "-";
        return `| ${t.id} | ${t.title.replace(/\|/g, "/")} | ${t.status} | ${a ? modelLink(a.model).replace("|", "\\|") : "-"} | ${t.attempts.length} | ${a?.review?.score ?? "-"} | ${checks} |`;
      });
      const accepted = s.tasks.filter((t) => t.status === "accepted").length;
      // follow-ups the agents and reviewers noted but did not do; the owner turns these into next tasks
      const follow = s.tasks.flatMap((t) => {
        const a = t.attempts.find((x) => x.decision === "accept") ?? t.attempts[t.attempts.length - 1];
        if (!a) return [];
        const report = a.reportFile && fs.existsSync(a.reportFile) ? fs.readFileSync(a.reportFile, "utf8") : "";
        const notes = ownFollowUps(followUps(report), s.tasks.filter((x) => x.id !== t.id).map((x) => x.id)).map((n) => `- **${t.id}** (agent): ${n}`);
        const findings = (a.review?.findings ?? []).map((f) => `- **${t.id}** (review, ${f.severity}): ${f.file ? `\`${f.file}\` ` : ""}${f.issue}`);
        const reverted = a.evidence?.reverted?.length ? [`- **${t.id}** (engine): undid out-of-scope edits to ${a.evidence.reverted.map((f) => `\`${f}\``).join(", ")}; check whether they were needed`] : [];
        const left = t.status === "accepted" ? a.blocked.map((b) => `- **${t.id}** (agent, left undone): ${b.replace(/^[-*\s]*(\*\*)?BLOCKED:(\*\*)?\s*/i, "")}`) : [];
        return [...notes, ...left, ...reverted, ...findings];
      });
      const body = [
        `# Report: ${s.request.split("\n")[0].slice(0, 100)}`,
        `Status **${s.status}**, ${accepted}/${s.tasks.length} tasks accepted, billed cost $${s.costUsd.toFixed(4)}, subscription usage equivalent $${(s.usageUsd ?? 0).toFixed(4)}.`,
        `| Task | Title | Status | Model | Attempts | Review | Evidence |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}`,
        accepted
          ? `## Next step (owner)\n\nAccepted work is on branch \`${s.integrationBranch}\` in \`${s.project.repo}\`. Nothing was merged into \`${s.project.baseBranch}\`.\n\n\`\`\`\ngit -C "${s.project.repo}" log --oneline ${s.project.baseBranch}..${s.integrationBranch}\ngit -C "${s.project.repo}" diff ${s.project.baseBranch}...${s.integrationBranch}\ngit -C "${s.project.repo}" merge ${s.integrationBranch}\n\`\`\``
          : "",
        follow.length ? `## Follow-ups\n\n${follow.join("\n")}` : "",
      ].filter(Boolean).join("\n\n");
      fs.writeFileSync(path.join(engine.vault.runDir(s.id), "report.md"), body + "\n");
      return "out";
    },
  },
];
