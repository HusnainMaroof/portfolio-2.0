// The Obsidian vault is the single store: agent profiles, projects, runs, tasks,
// execution records (what the router learns from) and model notes. Notes link to
// each other with [[wikilinks]], so the graph view shows who did what, where.
// Machine state that is not worth a note lives in vault/.orch/ (Obsidian hides dot folders).
import fs from "node:fs";
import path from "node:path";
import { parse, serialize, type Data } from "./frontmatter.ts";
import type { Attempt, Category, Mode, Project, RunState, Task, Tier } from "./types.ts";
import { now, posix, readJson, slug, writeJson, writeText } from "./util.ts";

export interface AgentProfile {
  category: Category;
  name: string;
  mode: Mode;
  minTier: Tier;
  timeoutMin: number;
  review: "always" | "risky" | "never";
  body: string;
}

export interface Execution {
  run: string;
  task: string;
  attempt: number;
  model: string;
  adapter: string;
  category: Category;
  risk: string;
  source: "run" | "benchmark" | "import";
  success: boolean;
  checksPassed: boolean;
  latencySec: number;
  costUsd: number;
  tokensIn: number;
  tokensCached?: number;
  tokensOut: number;
  retryIndex: number;
  reviewScore: number | null;
  toolFailure: string;
  decision: string;
  date: string;
}

export const modelSlug = (key: string) => key.replace(/[:/\\]+/g, "--").replace(/[^A-Za-z0-9._-]/g, "_");
export const modelLink = (key: string) => `[[Models/${modelSlug(key)}|${key}]]`;

export class Vault {
  readonly root: string;
  private execCache: { stamp: string; rows: Execution[] } | null = null;

  constructor(root: string) {
    this.root = root;
    for (const d of ["Agents", "Projects", "Runs", "Executions", "Models", "Code", ".orch"])
      fs.mkdirSync(path.join(root, d), { recursive: true });
  }

  p(...parts: string[]) {
    return path.join(this.root, ...parts);
  }
  state(file: string) {
    return this.p(".orch", file);
  }

  read(rel: string): { data: Data; body: string } | null {
    const f = this.p(rel);
    return fs.existsSync(f) ? parse(fs.readFileSync(f, "utf8")) : null;
  }
  write(rel: string, data: Data, body: string) {
    writeText(this.p(rel), serialize(data, body));
  }

  /* ---------- agents ---------- */
  agents(): Record<string, AgentProfile> {
    const out: Record<string, AgentProfile> = {};
    for (const f of fs.readdirSync(this.p("Agents")).filter((x) => x.endsWith(".md"))) {
      const n = this.read(`Agents/${f}`)!;
      const d = n.data;
      out[String(d.category)] = {
        category: d.category as Category,
        name: f.replace(/\.md$/, ""),
        mode: (d.mode as Mode) || "edit",
        minTier: (d.minTier as Tier) || "light",
        timeoutMin: Number(d.timeoutMin || 30),
        review: (d.review as AgentProfile["review"]) || "risky",
        body: n.body,
      };
    }
    return out;
  }

  /* ---------- projects ---------- */
  project(name: string): Project {
    const n = this.read(`Projects/${name}.md`);
    if (!n) throw new Error(`no project "${name}" (run: orch init <repo> --name ${name})`);
    const d = n.data;
    return {
      name,
      repo: String(d.repo),
      baseBranch: String(d.baseBranch || "main"),
      allowedCommands: (d.allowedCommands as string[]) || [],
      linkDirs: (d.linkDirs as string[]) || [],
      context: n.body,
    };
  }
  saveProject(p: Project) {
    const { name, context, ...data } = p;
    this.write(`Projects/${name}.md`, { ...data, type: "project" }, context || `# ${name}\n\nNotes about this project for the senior model.`);
  }

  /* ---------- runs and tasks ---------- */
  runDir(id: string) {
    return this.p("Runs", id);
  }
  /** Marks this process as the one executing the run. */
  lockRun(id: string) {
    fs.mkdirSync(this.runDir(id), { recursive: true });
    fs.writeFileSync(path.join(this.runDir(id), ".lock"), JSON.stringify({ pid: process.pid, since: now() }));
  }
  unlockRun(id: string) {
    fs.rmSync(path.join(this.runDir(id), ".lock"), { force: true });
  }
  /** pid of the live process executing the run, or null (none, or it crashed). */
  runOwner(id: string): number | null {
    const f = path.join(this.runDir(id), ".lock");
    if (!fs.existsSync(f)) return null;
    const { pid } = readJson<{ pid: number }>(f, { pid: 0 });
    try {
      process.kill(pid, 0);
      return pid;
    } catch {
      return null;
    }
  }

  saveState(s: RunState) {
    s.updatedAt = now();
    writeJson(path.join(this.runDir(s.id), "state.json"), s);
    this.writeRunNote(s);
  }
  loadState(id: string): RunState {
    const f = path.join(this.runDir(id), "state.json");
    if (!fs.existsSync(f)) throw new Error(`no run ${id}`);
    return readJson<RunState>(f, null as unknown as RunState);
  }
  runs(): RunState[] {
    return fs
      .readdirSync(this.p("Runs"))
      .filter((id) => fs.existsSync(path.join(this.runDir(id), "state.json")))
      .map((id) => this.loadState(id));
  }
  event(id: string, type: string, data: Data = {}) {
    fs.mkdirSync(this.runDir(id), { recursive: true });
    fs.appendFileSync(path.join(this.runDir(id), "events.jsonl"), JSON.stringify({ t: now(), type, ...data }) + "\n");
  }

  private writeRunNote(s: RunState) {
    const rows = s.tasks.map((t) => {
      const last = t.attempts[t.attempts.length - 1];
      return `| [[Runs/${s.id}/${t.id}\\|${t.id}]] | ${t.title.replace(/\|/g, "/")} | ${t.category} | ${t.risk} | ${t.status} | ${last ? modelLink(last.model).replace("|", "\\|") : "-"} | ${t.attempts.length} |`;
    });
    const u = s.understanding;
    const body = [
      `# ${s.request.split("\n")[0].slice(0, 100)}`,
      `Project: [[Projects/${s.project.name}]] · Workflow: \`${s.workflow}\` · Integration branch: \`${s.integrationBranch}\``,
      s.waiting ? `> [!warning] Waiting for you (${s.waiting.kind})\n> ${s.waiting.question.replace(/\n/g, "\n> ")}\n> Options: ${s.waiting.options.join(", ")}` : "",
      u ? `## Understanding\n\n**Goal:** ${u.goal}\n\n**Success criteria**\n${u.successCriteria.map((x) => `- ${x}`).join("\n")}\n\n**Constraints**\n${u.constraints.map((x) => `- ${x}`).join("\n")}\n\n**Assumptions**\n${u.assumptions.map((x) => `- ${x}`).join("\n")}` : "",
      rows.length ? `## Tasks\n\n| Task | Title | Category | Risk | Status | Model | Attempts |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}` : "",
      `## Request\n\n${s.request}`,
    ].filter(Boolean);
    this.write(
      `Runs/${s.id}/index.md`,
      { type: "run", run: s.id, project: s.project.name, status: s.status, costUsd: +s.costUsd.toFixed(4), created: s.createdAt, updated: s.updatedAt },
      body.join("\n\n"),
    );
    for (const t of s.tasks) this.writeTaskNote(s, t);
  }

  private writeTaskNote(s: RunState, t: Task) {
    const attempts = t.attempts.map((a: Attempt) => {
      const ev = a.evidence;
      const checks = ev?.checks.map((c) => `  - ${c.ok ? "PASS" : "FAIL"} \`${c.cmd}\`${c.value !== undefined ? ` value ${c.value}${c.baseline !== undefined ? ` (baseline ${c.baseline})` : ""}` : ""}`).join("\n");
      const scope = ev?.changed.map((c) => `  - ${c.inScope ? "ok" : "OUT OF SCOPE"} ${c.status} ${c.file}`).join("\n");
      const review = a.review ? `- Review by ${modelLink(a.review.model)}: **${a.review.score}/100** ${a.review.verdict}\n${a.review.findings.map((f) => `  - [${f.severity}] ${f.file ?? ""} ${f.issue}`).join("\n")}` : "";
      return [
        `### Attempt ${a.n}: ${modelLink(a.model)}`,
        `- Decision: **${a.decision ?? (a.reason ? "-" : "pending")}**${a.reason ? `, ${a.reason}` : ""}`,
        `- Latency ${(a.latencyMs / 1000).toFixed(0)} s, cost $${a.costUsd.toFixed(4)}, tokens ${a.tokensIn}/${a.tokensOut}${a.tokensCached && a.tokensCached > 0 ? ` (+${a.tokensCached} cached)` : ""}${a.failure ? `, tool failure: ${a.failure}` : ""}`,
        a.blocked.length ? `- Escalations:\n${a.blocked.map((b) => `  - ${b}`).join("\n")}` : "",
        scope ? `- Changed files:\n${scope}` : "",
        checks ? `- Checks:\n${checks}` : "",
        review,
        `- Report: \`${posix(path.relative(this.root, a.reportFile))}\``,
      ].filter(Boolean).join("\n");
    });
    this.write(
      `Runs/${s.id}/${t.id}.md`,
      { type: "task", run: s.id, task: t.id, category: t.category, risk: t.risk, status: t.status, attempts: t.attempts.length, branch: t.branch ?? null },
      [
        `# ${t.title}`,
        `Run: [[Runs/${s.id}/index|${s.id}]] · Agent: [[Agents/${t.category}]]${t.deps.length ? ` · Depends on: ${t.deps.map((d) => `[[Runs/${s.id}/${d}|${d}]]`).join(", ")}` : ""}`,
        `## Brief\n\n${t.brief}`,
        `## Allowed files\n\n${t.files.map((f) => `- \`${f}\``).join("\n") || "- (none, read-only)"}`,
        `## Acceptance checks\n\n${t.checks.map((c) => `- ${c.name}: \`${c.cmd}\`${c.measure ? ` (metric, expect ${c.expect ?? "lower"})` : ""}`).join("\n") || "- (none)"}`,
        t.candidates ? `## Router candidates\n\n${t.candidates.map((c) => `- ${c.score.toFixed(3)} ${modelLink(c.key)} (${c.why})`).join("\n")}` : "",
        attempts.length ? `## Attempts\n\n${attempts.join("\n\n")}` : "",
      ].filter(Boolean).join("\n\n"),
    );
  }

  /* ---------- execution records (router training data) ---------- */
  recordExecution(e: Execution) {
    this.write(`Executions/${e.run}-${e.task}-a${e.attempt}.md`, { type: "execution", ...e }, [
      `Run [[Runs/${e.run}/${e.task}|${e.run} / ${e.task}]] attempt ${e.attempt} by ${modelLink(e.model)}.`,
      `Decision: **${e.decision}**.`,
    ].join("\n\n"));
    this.execCache = null;
  }

  executions(): Execution[] {
    const dir = this.p("Executions");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const stamp = files.length + ":" + (files.length ? Math.max(...files.map((f) => fs.statSync(path.join(dir, f)).mtimeMs)) : 0);
    if (this.execCache?.stamp === stamp) return this.execCache.rows;
    const rows = files.map((f) => this.read(`Executions/${f}`)!.data as unknown as Execution).filter((r) => r.model);
    this.execCache = { stamp, rows };
    return rows;
  }

  /* ---------- model notes (temporal: history lines are append-only) ---------- */
  modelEvent(key: string, line: string) {
    fs.appendFileSync(this.state("model-history.jsonl"), JSON.stringify({ t: now(), key, line }) + "\n");
  }

  writeModelNote(key: string, info: Data = {}) {
    const rows = this.executions().filter((e) => e.model === key);
    const hist = fs.existsSync(this.state("model-history.jsonl"))
      ? fs.readFileSync(this.state("model-history.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { t: string; key: string; line: string }).filter((h) => h.key === key)
      : [];
    const byCat: Record<string, Execution[]> = {};
    for (const r of rows) (byCat[r.category] ||= []).push(r);
    const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const table = Object.entries(byCat).map(([c, xs]) => {
      const reviews = xs.map((x) => x.reviewScore).filter((x): x is number => typeof x === "number");
      return `| ${c} | ${xs.length} | ${pct(xs.filter((x) => x.success).length, xs.length)} | ${pct(xs.filter((x) => x.checksPassed).length, xs.length)} | ${reviews.length ? avg(reviews).toFixed(0) : "-"} | ${avg(xs.map((x) => x.latencySec)).toFixed(0)} | ${xs.filter((x) => x.toolFailure).length} |`;
    });
    this.write(
      `Models/${modelSlug(key)}.md`,
      {
        type: "model",
        key,
        ...info,
        runs: rows.length,
        accepted: rows.filter((r) => r.success).length,
        costUsd: +rows.reduce((a, r) => a + (r.costUsd || 0), 0).toFixed(4),
        updated: now(),
      },
      [
        `# ${key}`,
        table.length ? `| Category | Runs | Accepted | Checks pass | Avg review | Avg latency s | Tool failures |\n|---|---|---|---|---|---|---|\n${table.join("\n")}` : "No executions yet.",
        `## Executions\n\n${rows.map((r) => `- ${r.date.slice(0, 10)} [[Executions/${r.run}-${r.task}-a${r.attempt}|${r.run}/${r.task}#${r.attempt}]] ${r.category}: ${r.decision}`).join("\n") || "-"}`,
        `## History\n\n${hist.map((h) => `- ${h.t.slice(0, 16)} ${h.line}`).join("\n") || "-"}`,
      ].join("\n\n"),
    );
  }

  newRunId(request: string) {
    const base = `${now().slice(0, 10)}-${slug(request).slice(0, 40)}`;
    let id = base;
    for (let i = 2; fs.existsSync(this.runDir(id)); i++) id = `${base}-${i}`;
    return id;
  }
}
