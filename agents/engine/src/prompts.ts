// Every prompt the engine sends. Kept in one place so they are easy to tune.
import fs from "node:fs";
import path from "node:path";
import { FILE_PROTOCOL, REPORT_NAME } from "./adapters/common.ts";
import type { Evidence, RunState, Task, Terse } from "./types.ts";
import type { AgentProfile } from "./vault.ts";
import { git, ROOT } from "./util.ts";

const rules = (mode: string) => fs.readFileSync(path.join(ROOT, "config", "rules", `${mode}.md`), "utf8").trim();

/**
 * Token-saving output style for agent-to-agent text (reports, findings, JSON
 * fields), after the Caveman skill (github.com/JuliusBrussee/caveman). It only
 * shortens prose; code, commands, paths, errors and numbers stay exact. Never
 * used for text the owner reads.
 */
export function terseRule(level: Terse): string {
  if (level === "off") return "";
  const base = "OUTPUT STYLE: your text is read by another model, not a person. Keep code, commands, file paths, error messages, numbers and JSON exact and complete.";
  if (level === "lite") return `${base} Be concise: no filler, no pleasantries, no restating the task.`;
  if (level === "full") return `${base} Write prose caveman-style: short fragments, drop articles and filler words, no pleasantries, no hedging, one point per line.`;
  return `${base} Ultra-terse: fragments only, abbreviations and symbols (->, =, w/, b/c, ~), no articles, one line per point.`;
}

export const JSON_ONLY = "Answer with ONE JSON object in a ```json fence and nothing else.";

export function repoSnapshot(s: RunState, vaultCode: string) {
  const repo = s.project.repo;
  const files = git(repo, "ls-files").out.split("\n").filter(Boolean);
  const readme = ["README.md", "readme.md", "README"].map((f) => path.join(repo, f)).find((f) => fs.existsSync(f));
  const manifest = ["package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml"].map((f) => path.join(repo, f)).find((f) => fs.existsSync(f));
  const graph = path.join(vaultCode, "GRAPH_REPORT.md");
  return [
    `REPO: ${repo} (${files.length} tracked files)`,
    `FILES (first 400):\n${files.slice(0, 400).join("\n")}`,
    manifest ? `${path.basename(manifest)}:\n${fs.readFileSync(manifest, "utf8").slice(0, 3000)}` : "",
    readme ? `README (head):\n${fs.readFileSync(readme, "utf8").slice(0, 3000)}` : "",
    fs.existsSync(graph) ? `CODE GRAPH (Graphify report, head):\n${fs.readFileSync(graph, "utf8").slice(0, 6000)}` : "",
    s.project.context ? `PROJECT NOTES:\n${s.project.context.slice(0, 3000)}` : "",
  ].filter(Boolean).join("\n\n");
}

export function understandPrompt(s: RunState, snapshot: string, terse: Terse) {
  return [
    "ORCH:senior.understand",
    "You are the senior engineer and manager of a team of AI coding agents. Step 1: understand the owner's request before any work is planned. Read the repository as needed (read-only).",
    terseRule(terse),
    `OWNER REQUEST:\n${s.request}`,
    snapshot,
    "Return: goal (one sentence), constraints, successCriteria (observable and checkable: commands, measurements, behaviour), assumptions, and questions (only blocking ones where two readings lead to clearly different work; otherwise [] and state the assumption).",
    JSON_ONLY,
    '{"goal":"","constraints":[],"successCriteria":[],"assumptions":[],"questions":[]}',
  ].filter(Boolean).join("\n\n");
}

export function planPrompt(s: RunState, snapshot: string, agents: Record<string, AgentProfile>, terse: Terse, lessons: string[] = []) {
  const roster = Object.values(agents).map((a) => `- ${a.category} (${a.mode}): ${a.body.split("\n").find((l) => l.trim()) ?? ""}`).join("\n");
  return [
    "ORCH:senior.plan",
    "You are the senior engineer. Step 2: break the work into small tasks for your agents. You manage; agents do the work. Read the repository as needed (read-only) so file lists are exact.",
    terseRule(terse),
    `UNDERSTANDING:\n${JSON.stringify(s.understanding, null, 1)}`,
    `AGENTS (category, mode):\n${roster}`,
    `COMMANDS THE ENGINE MAY RUN WITHOUT ASKING (prefixes): ${s.project.allowedCommands.join(", ") || "(none: every check needs owner approval)"}`,
    [
      "RULES:",
      "- One task = one category = one bounded change. Prefer several small tasks over one big one. Usually 1 to 6 tasks.",
      "- files: exact repo-relative paths (or folders ending with /) the agent may change. Read-only tasks (research, review, architecture) have files [].",
      "- When the request only asks to explain, investigate, analyse or answer a question (nothing should change), use category research with files [] and no checks; the report is the answer. Use docs only when the request asks to write or change documentation files.",
      "- Tasks that change the same file must be ordered with deps, never independent.",
      "- Tasks with no deps between them and no shared files run at the same time. Split work by file where it is natural, and only add deps a task really needs; never make deps circular.",
      "- Do NOT add tasks that only review, verify or test another task's change: the engine already runs every task's checks itself and has each change reviewed by an independent model. Review tasks are only for reviewing existing code the request asks about.",
      "- deps: ids of tasks whose output this task needs. Research/debugging reports are passed to dependent tasks.",
      "- checks: shell commands the ENGINE runs in the task's worktree after the agent finishes; exit code 0 = pass. They are the evidence; agents' claims are not trusted. Use existing test/lint/type-check commands, or a small one-liner that proves the behaviour.",
      "- Performance work: add a check with measure:true whose LAST printed number is the metric, expect \"lower\" or \"higher\"; it is measured before and after the change.",
      "- risk: low (docs, tests, read-only), medium (logic in a few files), high (auth, money, data deletion, migrations, dependencies, config, security). High risk needs owner approval.",
      "- brief: what to do, where, the root cause if known, and what done looks like. Precise briefs are the biggest lever on agent quality.",
    ].join("\n"),
    snapshot,
    lessons.length
      ? `LESSONS FROM RECENT RUNS OF THIS PROJECT (failures, retries, open follow-ups; plan around them, and turn a follow-up into a task only if the request needs it):
${lessons.map((l) => `- ${l}`).join("\n")}`
      : "",
    JSON_ONLY,
    '{"tasks":[{"id":"t1","title":"","category":"coding","risk":"low","brief":"","files":["src/x.ts"],"deps":[],"checks":[{"name":"tests","cmd":"npm test"}]}]}',
  ].filter(Boolean).join("\n\n");
}

/** Who does what in this run, so an agent neither does nor reports another task's part. */
function otherTasks(s: RunState, t: Task): string {
  const others = s.tasks.filter((x) => x.id !== t.id && x.status !== "skipped");
  if (!others.length) return "";
  const lines = others.map((x) => `- ${x.id}: ${x.title}${x.files.length ? ` (files: ${x.files.join(", ")})` : " (read-only)"}`);
  return `OTHER TASKS IN THIS RUN (other agents do these, before, after or alongside you; do not do them and do not list them as follow-ups or BLOCKED):\n${lines.join("\n")}`;
}

export function workerPrompt(o: {
  s: RunState;
  t: Task;
  profile: AgentProfile;
  cwd: string;
  terse: Terse;
  apiEdit: boolean;
  depReports: string[];
  neighbours: string[];
}) {
  const { s, t, profile, cwd } = o;
  const last = t.attempts[t.attempts.length - 1];
  const fileBodies = o.apiEdit
    ? t.files
        .filter((f) => !f.endsWith("/") && !f.includes("*") && fs.existsSync(path.join(cwd, f)))
        .map((f) => `<<<CURRENT ${f}>>>\n${fs.readFileSync(path.join(cwd, f), "utf8").slice(0, 60_000)}\n<<<END CURRENT>>>`)
        .join("\n\n")
    : "";
  return [
    "ORCH:worker",
    rules(profile.mode),
    terseRule(o.terse),
    `ROLE (${profile.name}):\n${profile.body}`,
    `WORKSPACE: ${cwd.replace(/\\/g, "/")}\nWork only inside it. It is an isolated copy; nothing reaches the owner until reviewed.`,
    `TASK ${t.id}: ${t.title}\n\n${t.brief}`,
    `ALLOWED FILES:\n${t.files.map((f) => `- ${f}`).join("\n") || "- none (read-only task: change nothing)"}`,
    t.checks.length ? `ACCEPTANCE CHECKS (the engine runs these after you finish; run them yourself first if you can):\n${t.checks.map((c) => `- ${c.cmd}`).join("\n")}` : "",
    s.understanding ? `OVERALL GOAL (context only: other tasks cover the other parts; do only YOUR task, and do not report the other parts as BLOCKED): ${s.understanding.goal}` : "",
    otherTasks(s, t),
    o.neighbours.length ? `RELATED FILES (from the code map: what your files use and what uses them; read them when your change affects them, edit only ALLOWED FILES):\n${o.neighbours.join("\n")}` : "",
    o.depReports.length ? `CONTEXT FROM EARLIER TASKS:\n${o.depReports.join("\n\n")}` : "",
    t.critique && last ? `CORRECTION (attempt ${t.attempts.length + 1}). Your previous attempt was rejected. Fix exactly these points, keep what was right:\n${t.critique}` : "",
    o.apiEdit ? `${FILE_PROTOCOL}\n\n${fileBodies}` : "",
    o.apiEdit
      ? "REPORT: after the file blocks write: ## Assumptions, ## Changes (file: what and why), one line starting with BLOCKED: only for a decision that stopped you from finishing, and ## Follow-ups for anything else worth doing later that no other task in this run covers."
      : profile.mode === "readonly"
        ? `REPORT: give your report as your final answer (read-only: do not create any file, not even a report file). Sections: ## Findings (one line each: file:line, severity, what), ## Details, ## Recommendation, one line starting with BLOCKED: only for a question that stopped you (never "BLOCKED: none"), and ## Follow-ups.`
        : `REPORT: when done, write your report to the file ${REPORT_NAME} in the workspace root (or, if you cannot write files, give it as your final answer). Sections: ## Assumptions, ## Changes (file: before -> after), ## Self-check (commands + output), one line starting with BLOCKED: only per decision that stopped you from finishing part of the task (never "BLOCKED: none"), and ## Follow-ups for suggestions or cleanups you did not need that no other task in this run covers.`,
  ].filter(Boolean).join("\n\n");
}

export function reviewPrompt(o: { s: RunState; t: Task; ev: Evidence; diff: string; report: string; terse: Terse }) {
  const { t, ev } = o;
  return [
    "ORCH:review",
    "You are an independent code reviewer. Another agent made this change. Judge it from the diff and the evidence, not from its report. Do not modify files.",
    "The engine already ran every acceptance check in this workspace; the results are under ENGINE EVIDENCE. Do not run builds, tests, installs or other commands: read the diff and, only when needed, the files it touches. Problems of your own environment are not findings.",
    terseRule(o.terse),
    `TASK ${t.id} (${t.category}, risk ${t.risk}): ${t.title}\n${t.brief}`,
    `ALLOWED FILES: ${t.files.join(", ") || "(none)"}`,
    `ENGINE EVIDENCE:\n- scope: ${ev.scopeOk ? "all changed files allowed" : "FILES OUTSIDE SCOPE: " + ev.changed.filter((c) => !c.inScope).map((c) => c.file).join(", ")}\n${ev.reverted?.length ? `- the engine undid out-of-scope edits to ${ev.reverted.join(", ")} (not in the diff); judge whether the change is complete without them\n` : ""}${ev.checks.map((c) => `- ${c.ok ? "PASS" : "FAIL"} ${c.cmd}${c.value !== undefined ? ` value=${c.value} baseline=${c.baseline ?? "-"}` : ""}`).join("\n")}`,
    `AGENT REPORT (claims, unverified):\n${o.report.slice(0, 4000)}`,
    `DIFF:\n${o.diff.slice(0, 60_000)}`,
    "Score 0-100: goal met (25), correctness incl. edge cases, regressions, security and data isolation (25), surgical: only what the task needs (25), simple: no needless code (25). Severity: critical | high | medium | low. Any critical or high finding means the change must not be accepted as is.",
    JSON_ONLY,
    '{"score":0,"verdict":"one line","findings":[{"severity":"high","file":"src/x.ts","issue":""}]}',
  ].filter(Boolean).join("\n\n");
}

export function confirmPrompt(o: { t: Task; ev: Evidence; diff: string; review?: string }) {
  return [
    "ORCH:senior.confirm",
    "You are the senior engineer. A high-risk task passed automated checks. Decide whether to accept it. Do not trust claims; use the evidence and the diff.",
    `TASK ${o.t.id}: ${o.t.title}\n${o.t.brief}`,
    `EVIDENCE:\n${o.ev.checks.map((c) => `- ${c.ok ? "PASS" : "FAIL"} ${c.cmd}${c.value !== undefined ? ` value=${c.value} baseline=${c.baseline ?? "-"}` : ""}`).join("\n")}`,
    o.review ? `INDEPENDENT REVIEW:\n${o.review}` : "",
    `DIFF:\n${o.diff.slice(0, 60_000)}`,
    JSON_ONLY,
    '{"decision":"accept|retry|reassign|escalate","reason":"","critique":"exact fixes if retry"}',
  ].filter(Boolean).join("\n\n");
}
