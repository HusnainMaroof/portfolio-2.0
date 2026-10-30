// Benchmark scoring: one attempt, no retries, pass/fail from engine evidence only.
// Records an execution with source "benchmark", which feeds the router's 30% signal.
import fs from "node:fs";
import type { NodeType } from "./index.ts";
import { now } from "../util.ts";

export const benchNodes: NodeType[] = [
  {
    type: "bench.score",
    label: "Score benchmark",
    group: "verify",
    description: "Pass/fail for a benchmark attempt: edit tasks need in-scope changes and all checks passing; read-only tasks need no changes and a report matching the expected findings. Records the result for the router.",
    ports: ["out"],
    params: [],
    async run({ engine, s, task, log }) {
      const t = task();
      const a = t.attempts[t.attempts.length - 1];
      if (!a) {
        t.status = "skipped";
        engine.ws.removeTask(s, t);
        log(`${t.id}: no attempt (model unavailable)`);
        return "out";
      }
      const ev = a.evidence;
      const report = fs.existsSync(a.reportFile) ? fs.readFileSync(a.reportFile, "utf8") : "";
      const misses = (t.reportMatch ?? []).filter((re) => !new RegExp(re, "i").test(report));
      const readonly = engine.agents()[t.category]?.mode === "readonly";
      const why: string[] = [];
      if (a.failure) why.push(`tool failure ${a.failure}`);
      if (ev && !ev.scopeOk) why.push(readonly ? "changed files in a read-only task" : "out-of-scope changes");
      if (ev && !ev.checksOk) why.push(`failed: ${ev.checks.filter((c) => !c.ok).map((c) => c.name).join(", ")}`);
      if (ev && ev.checksSkipped) why.push(`checks not run (${ev.checksSkipped})`);
      if (ev && !readonly && ev.diffLines === 0) why.push("no changes");
      if (misses.length) why.push(`report misses ${misses.join(" | ")}`);
      const ok = !why.length;
      a.reason = `benchmark ${ok ? "PASS" : "FAIL"}${why.length ? `: ${why.join("; ")}` : ""}`;
      t.status = ok ? "accepted" : "failed";
      engine.vault.recordExecution({
        run: s.id,
        task: t.id,
        attempt: a.n,
        model: a.model,
        adapter: a.model.split(":")[0],
        category: t.category,
        risk: t.risk,
        source: "benchmark",
        success: ok,
        checksPassed: !!ev && ev.scopeOk && ev.checksOk && !ev.checksSkipped,
        latencySec: Math.round(a.latencyMs / 1000),
        costUsd: +a.costUsd.toFixed(5),
        tokensIn: Math.round(a.tokensIn),
        tokensCached: a.tokensCached === undefined ? undefined : Math.round(a.tokensCached),
        tokensOut: Math.round(a.tokensOut),
        retryIndex: 0,
        reviewScore: null,
        toolFailure: a.failure ?? "",
        decision: ok ? "pass" : "fail",
        date: now(),
      });
      engine.vault.writeModelNote(a.model);
      engine.ws.reset(t, s.project);
      engine.ws.removeTask(s, t);
      log(`${t.id} on ${a.model}: ${a.reason}`);
      return "out";
    },
  },
];
