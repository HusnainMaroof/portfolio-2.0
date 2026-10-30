// Deterministic fake provider for tests, without
// spending tokens. Behaviour comes from a script file (ORCH_MOCK_SCRIPT):
//   { models: [{model, tier}], understand: {...}, plan: {tasks: [...]},
//     edits: { "<model>": [{file, find, replace}] }, review: {score, verdict, findings},
//     stray?: { "<model>": [{file, content}] } (written outside the allowed files), say?: { "<model>": "extra report text" } }
import fs from "node:fs";
import path from "node:path";
import type { Adapter, ModelInfo, Mode, RunRequest, RunResult } from "../types.ts";

interface Script {
  models: { model: string; tier: ModelInfo["tier"] }[];
  understand: unknown;
  plan: unknown;
  edits: Record<string, { file: string; find: string; replace: string }[]>;
  review: unknown;
  confirm?: unknown;
  stray?: Record<string, { file: string; content: string }[]>;
  say?: Record<string, string>;
}

export class MockAdapter implements Adapter {
  kind = "mock" as const;
  id = "mock";
  modes: Mode[] = ["edit", "readonly"];

  private script(): Script {
    const f = process.env.ORCH_MOCK_SCRIPT;
    if (!f || !fs.existsSync(f)) throw new Error("mock adapter needs ORCH_MOCK_SCRIPT");
    return JSON.parse(fs.readFileSync(f, "utf8"));
  }

  async available() {
    return !!process.env.ORCH_MOCK_SCRIPT;
  }

  async discover(): Promise<ModelInfo[]> {
    return this.script().models.map((m) => ({ key: `mock:${m.model}`, adapter: "mock", model: m.model, tier: m.tier, free: true, contextLength: 128000, modes: this.modes }));
  }

  async run(req: RunRequest): Promise<RunResult> {
    const s = this.script();
    const kind = req.prompt.match(/^ORCH:(\S+)/m)?.[1] ?? "worker";
    let text = "";
    if (kind === "senior.understand") text = "```json\n" + JSON.stringify(s.understand) + "\n```";
    else if (kind === "senior.plan") text = "```json\n" + JSON.stringify(s.plan) + "\n```";
    else if (kind === "senior.confirm") text = "```json\n" + JSON.stringify(s.confirm ?? { decision: "accept", reason: "mock" }) + "\n```";
    else if (kind === "review") text = "```json\n" + JSON.stringify(s.review) + "\n```";
    else {
      const changed: string[] = [];
      for (const e of s.edits[req.model] || []) {
        if (req.allowedFiles?.length && !req.allowedFiles.includes(e.file)) continue; // agents stay in their task's files
        const f = path.join(req.cwd, e.file);
        const before = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
        if (before.includes(e.find)) {
          fs.writeFileSync(f, before.replace(e.find, e.replace));
          changed.push(e.file);
        }
      }
      for (const x of s.stray?.[req.model] || []) fs.writeFileSync(path.join(req.cwd, x.file), x.content);
      text = `## Assumptions\n- mock run\n\n## Changes\n${changed.map((c) => `- ${c}`).join("\n") || "- nothing changed"}\n${s.say?.[req.model] ?? ""}`;
    }
    fs.writeFileSync(req.logFile, `mock ${req.model} ${kind}\n${text}\n`);
    return { ok: true, text, exitCode: 0, latencyMs: 5, tokensIn: req.prompt.length / 4, tokensOut: text.length / 4, costUsd: 0 };
  }
}
