// Senior-model nodes: understand, plan, decide. The senior manages; it does not code.
import path from "node:path";
import type { NodeType } from "./index.ts";
import { confirmPrompt, planPrompt, repoSnapshot, understandPrompt } from "../prompts.ts";
import { pastLessons } from "../lessons.ts";
import { CATEGORIES, WAIT, type Category, type Check, type Decision, type Risk, type Task } from "../types.ts";
import { now, slug } from "../util.ts";
import { stillBlocked } from "./agent.ts";
import fs from "node:fs";

const RISKS: Risk[] = ["low", "medium", "high"];

export const seniorNodes: NodeType[] = [
  {
    type: "senior.understand",
    label: "Understand request",
    group: "senior",
    description: "Senior model reads the request and the repo, states goal, constraints, success criteria and assumptions. Can stop to ask the owner blocking questions.",
    ports: ["out"],
    params: [{ name: "askQuestions", type: "boolean", default: true, description: "Pause for the owner when the senior has blocking questions." }],
    async run({ engine, s, params, log }) {
      if (s.input && s.waiting?.kind === "question") {
        let answer = s.input.note || s.input.choice;
        if (s.waiting.question && s.input.choice && s.input.choice !== "answer") {
          const optionText = parseOptionText(s.waiting.question, s.input.choice);
          answer = `${optionText}${s.input.note ? ` (note: ${s.input.note})` : ""}`;
        }
        s.request += `\n\nOwner answers: ${answer}`;
        s.waiting = undefined;
        s.input = undefined;
      }
      const snap = repoSnapshot(s, path.join(engine.cfg.vault, "Code", s.project.name));
      const { data, key } = await engine.senior<NonNullable<typeof s.understanding>>(s, "understand", understandPrompt(s, snap, engine.cfg.terse));
      s.understanding = {
        goal: String(data.goal || ""),
        constraints: arr(data.constraints),
        successCriteria: arr(data.successCriteria),
        assumptions: arr(data.assumptions),
        questions: arr(data.questions),
      };
      log(`understood by ${key}: ${s.understanding.goal}`);
      if (params.askQuestions && s.understanding.questions.length) {
        const extraOptions = questionChoices(data.questions);
        s.waiting = { kind: "question", question: s.understanding.questions.join("\n"), options: ["answer", ...extraOptions] };
        return WAIT;
      }
      return "out";
    },
  },
  {
    type: "senior.plan",
    label: "Plan tasks",
    group: "senior",
    description: "Senior model breaks the work into small tasks with category, files, dependencies, acceptance checks and risk.",
    ports: ["out"],
    params: [{ name: "maxTasks", type: "number", default: 8, description: "Upper bound on tasks per run." }],
    async run({ engine, s, params, log }) {
      const snap = repoSnapshot(s, path.join(engine.cfg.vault, "Code", s.project.name));
      const runs = engine.vault.runs().map((r) => {
        const f = path.join(engine.vault.runDir(r.id), "report.md");
        return { s: r, report: fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "" };
      });
      const { data, key } = await engine.senior<{ tasks: Partial<Task>[] }>(s, "plan", planPrompt(s, snap, engine.agents(), engine.cfg.terse, pastLessons(runs, s.project.name, s.id)));
      const raw = (data.tasks || []).slice(0, Number(params.maxTasks));
      if (!raw.length) throw new Error("senior returned no tasks");
      const ids = new Set<string>();
      s.tasks = raw.map((r, i) => {
        let id = slug(String(r.id || `t${i + 1}`));
        while (ids.has(id)) id += "x";
        ids.add(id);
        const category = (CATEGORIES as readonly string[]).includes(String(r.category)) ? (r.category as Category) : "coding";
        const checks: Check[] = (Array.isArray(r.checks) ? r.checks : [])
          .filter((c: any) => c && c.cmd)
          .map((c: any, j: number) => ({ name: String(c.name || `check${j + 1}`), cmd: String(c.cmd), measure: !!c.measure, expect: c.expect }));
        const t: Task = {
          id,
          title: String(r.title || id),
          category,
          risk: RISKS.includes(r.risk as Risk) ? (r.risk as Risk) : "medium",
          brief: String(r.brief || r.title || ""),
          files: arr(r.files),
          deps: arr(r.deps).map(slug),
          checks,
          status: "pending",
          attempts: [],
          excluded: [],
          reassigns: 0,
        };
        const unknown = checks.filter((c) => !s.project.allowedCommands.some((p) => c.cmd.trim().startsWith(p)));
        if (unknown.length) t.approvalReason = `check commands outside the allow-list: ${unknown.map((c) => c.cmd).join(" ; ")}`;
        else if (t.risk === "high") t.approvalReason = "high risk";
        return t;
      });
      for (const t of s.tasks) t.deps = t.deps.filter((d) => ids.has(d) && d !== t.id);
      log(`planned ${s.tasks.length} task(s) with ${key}`, { tasks: s.tasks.map((t) => `${t.id}:${t.category}:${t.risk}`) });
      return "out";
    },
  },
  {
    type: "senior.decide",
    label: "Decide",
    group: "senior",
    description: "Evidence-based verdict on the last attempt: accept, retry with a correction, reassign to another model, or escalate to the owner. Optionally asks the senior model to confirm high-risk accepts.",
    ports: ["accept", "retry", "reassign", "escalate"],
    params: [
      { name: "acceptScore", type: "number", default: 80, description: "Minimum review score to accept." },
      { name: "retryScore", type: "number", default: 50, description: "Below this the task is reassigned instead of retried." },
      { name: "seniorConfirm", type: "select", options: ["never", "high-risk", "always"], default: "high-risk", description: "When the senior model must confirm an accept." },
    ],
    async run({ engine, s, params, task, log }) {
      const t = task();
      const a = t.attempts[t.attempts.length - 1];
      const L = engine.cfg.limits;
      const profile = engine.agents()[t.category];
      const sameModel = t.attempts.filter((x) => x.model === a.model && !x.failure).length;
      const ev = a.evidence;
      let decision: Decision;
      let reason: string;
      let critique = "";

      if (a.blocked.length && !stillBlocked(a, profile?.mode ?? "edit")) log(`${t.id}: checks pass, so these BLOCKED lines go to follow-ups: ${a.blocked.join(" | ")}`);
      if (stillBlocked(a, profile?.mode ?? "edit")) {
        decision = "escalate";
        reason = `agent escalated: ${a.blocked.join(" | ")}`;
      } else if (a.failure) {
        decision = "reassign";
        reason = `tool failure: ${a.failure}`;
      } else if (!ev) {
        decision = "reassign";
        reason = "no evidence";
      } else if (profile?.mode === "edit" && ev.diffLines === 0) {
        decision = sameModel < L.maxSameModel ? "retry" : "reassign";
        reason = "no changes made";
        critique = "You changed nothing. Make the change the task asks for in the allowed files.";
      } else if (!ev.scopeOk || !ev.checksOk) {
        decision = sameModel < L.maxSameModel ? "retry" : "reassign";
        const out = ev.changed.filter((c) => !c.inScope).map((c) => c.file);
        const failed = ev.checks.filter((c) => !c.ok);
        reason = [out.length ? `out of scope: ${out.join(", ")}` : "", failed.length ? `failed checks: ${failed.map((c) => c.name).join(", ")}` : ""].filter(Boolean).join("; ");
        critique = [
          ...out.map((f, i) => `${i + 1}. Revert your change to ${f}: it is not in the allowed files.`),
          ...(ev.reverted?.length ? [`- The engine undid your edits to ${ev.reverted.join(", ")} (not in the allowed files). Make the task work without them; if it truly cannot, write a BLOCKED: line naming the file and why.`] : []),
          ...failed.map((c) => `- Check \`${c.cmd}\` failed${c.value !== undefined ? ` (value ${c.value}, baseline ${c.baseline})` : ""}:\n\`\`\`\n${c.tail}\n\`\`\``),
        ].join("\n");
      } else if (a.review) {
        const severe = a.review.findings.filter((f) => /critical|high/i.test(f.severity));
        if (a.review.score >= Number(params.acceptScore) && !severe.length) {
          decision = "accept";
          reason = `checks pass, review ${a.review.score}`;
        } else {
          decision = a.review.score >= Number(params.retryScore) && sameModel < L.maxSameModel ? "retry" : "reassign";
          reason = `review ${a.review.score}${severe.length ? `, ${severe.length} severe finding(s)` : ""}`;
          critique = a.review.findings.map((f, i) => `${i + 1}. [${f.severity}] ${f.file ?? ""} ${f.issue}`).join("\n");
        }
      } else if (a.reason === "review unavailable" && t.risk === "high") {
        decision = "escalate";
        reason = "high-risk change and no independent reviewer was available";
      } else {
        decision = "accept";
        reason = "automated checks pass";
      }

      // high-risk accepts get a second look from the senior model itself
      const confirm = params.seniorConfirm === "always" || (params.seniorConfirm === "high-risk" && t.risk === "high");
      if (decision === "accept" && confirm && ev) {
        const diff = fs.existsSync(ev.diffFile) ? fs.readFileSync(ev.diffFile, "utf8") : "";
        const review = a.review ? `${a.review.score}/100 ${a.review.verdict}\n${a.review.findings.map((f) => `- [${f.severity}] ${f.issue}`).join("\n")}` : undefined;
        const data = await engine
          .senior<{ decision: Decision; reason: string; critique?: string }>(s, "confirm", confirmPrompt({ t, ev, diff, review }))
          .then((r) => r.data)
          .catch((e: Error) => {
            // no senior to confirm: the owner decides this one task instead of the whole run failing
            log(`${t.id}: ${e.message}; asking the owner to confirm`);
            return { decision: "escalate" as Decision, reason: "no senior model available to confirm this high-risk change", critique: undefined as string | undefined };
          });
        if (["accept", "retry", "reassign", "escalate"].includes(data.decision) && data.decision !== "accept") {
          decision = data.decision;
          reason = `senior: ${data.reason}`;
          critique = data.critique || data.reason;
        }
      }

      if ((decision === "retry" || decision === "reassign") && t.attempts.length >= L.maxAttempts) {
        decision = "escalate";
        reason = `${t.attempts.length} attempts used; last: ${reason}`;
      }
      if (decision === "reassign") {
        t.excluded.push(a.model);
        t.reassigns++;
        if (t.reassigns >= L.reassignsBeforeTierUp) t.minTier = t.minTier === "standard" || !t.minTier ? "strong" : t.minTier === "strong" ? "premium" : t.minTier;
      }
      a.decision = decision;
      a.reason = reason;
      t.critique = critique || undefined;
      if (decision === "accept") t.status = "accepted";
      log(`${t.id} attempt ${a.n} (${a.model}): ${decision}, ${reason}`);

      const [adapter] = a.model.split(":");
      engine.vault.recordExecution({
        run: s.id,
        task: t.id,
        attempt: a.n,
        model: a.model,
        adapter,
        category: t.category,
        risk: t.risk,
        source: "run",
        success: decision === "accept",
        checksPassed: !!ev && ev.scopeOk && ev.checksOk && !ev.checksSkipped,
        latencySec: Math.round(a.latencyMs / 1000),
        costUsd: +a.costUsd.toFixed(5),
        tokensIn: Math.round(a.tokensIn),
        tokensCached: a.tokensCached === undefined ? undefined : Math.round(a.tokensCached),
        tokensOut: Math.round(a.tokensOut),
        retryIndex: a.n - 1,
        reviewScore: a.review?.score ?? null,
        toolFailure: a.failure ?? "",
        decision,
        date: now(),
      });
      const info = await engine.models.info(a.model);
      engine.vault.writeModelNote(a.model, info ? { tier: info.tier, free: info.free, context: info.contextLength ?? null } : {});
      if (a.review) engine.vault.writeModelNote(a.review.model);
      return decision;
    },
  },
];

/** Senior lists as text. Models sometimes answer with objects ({question, whyBlocking, options}); String() would turn those into "[object Object]". */
export function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asText) : v ? [asText(v)] : [];
}

function asText(x: unknown): string {
  if (x === null || typeof x !== "object") return String(x);
  const o = x as Record<string, unknown>;
  const main = o.question ?? o.text ?? o.description ?? o.title;
  if (typeof main !== "string") return JSON.stringify(x);
  const why = typeof o.whyBlocking === "string" ? ` (why it matters: ${o.whyBlocking})` : "";
  const opts = Array.isArray(o.options) && o.options.length ? ` Options: ${o.options.map((p, i) => `(${i + 1}) ${String(p)}`).join(" ")}` : "";
  return main + why + opts;
}

/** Extract numbered choices from questions array: if first element is an object with non-empty options, return ["1", "2", ...]. */
export function questionChoices(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  if (first === null || typeof first !== "object") return [];
  const o = first as Record<string, unknown>;
  const opts = o.options;
  if (!Array.isArray(opts) || opts.length === 0) return [];
  return opts.map((_, i) => String(i + 1));
}

/** Parse the option text from a question string like "(N) text" up to " (N+1) " or end of line. */
function parseOptionText(question: string, choice: string): string {
  const num = parseInt(choice, 10);
  if (isNaN(num) || num < 1) return choice;
  const pattern = new RegExp(`\\(${num}\\)\\s+([^\\n]*?)(?=\\s+\\(${num + 1}\\)|\\n|$)`);
  const match = question.match(pattern);
  return match ? match[1].trim() : choice;
}
