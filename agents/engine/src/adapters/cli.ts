// One adapter for every agentic CLI (Claude Code, Cline, OpenCode, Kilo, Codex, ...).
// A CLI is described in config by command templates; adding a new CLI is config, not code.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProviderConfig } from "../config.ts";
import type { Adapter, ModelInfo, Mode, RunRequest, RunResult } from "../types.ts";
import { BASH, commandExists, posix, ROOT, shell } from "../util.ts";
import { classify, isErrorOnly, REPORT_NAME, stripAnsi } from "./common.ts";

const FAKE_GIT = "/tmp/no-git-for-agents";

// Some CLIs spawn a long-lived shared daemon (Cline's hub) whose working directory is
// wherever the first run started. Inside a worktree it would lock that folder on Windows,
// so the daemon is started once from a neutral folder and every run reuses it. It is
// stopped when the engine exits; left running it stays after the run and piles up.
const prestarted = new Map<string, Promise<unknown>>();
function prestart(cmd: string, stop?: string) {
  if (!prestarted.has(cmd)) {
    const cwd = path.join(os.homedir(), ".orch");
    fs.mkdirSync(cwd, { recursive: true });
    prestarted.set(cmd, shell(cmd, { cwd, timeoutMs: 60_000 }));
    // exit handlers must be synchronous
    if (stop) process.once("exit", () => spawnSync(BASH, ["-c", stop], { cwd, timeout: 30_000 }));
  }
  return prestarted.get(cmd);
}

/**
 * Command Code with --output-format json prints NDJSON (one object per line) and exits 0 even on
 * errors; the result object is the last one. Its real error text is in there, not on stderr.
 */
export function parseCommandCode(
  out: string,
): { text: string; isError: boolean; error: string; tokensIn: number; tokensCached: number; tokensOut: number } | null {
  const lines = stripAnsi(out).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim().startsWith("{")) continue;
    let o: any;
    try {
      o = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (!o || typeof o !== "object" || o.type !== "result") continue;
    const u = o.usage || {};
    return {
      text: String(o.finalText ?? ""),
      isError: o.subtype !== "success",
      error: String(o.error ?? ""),
      tokensIn: Number(u.inputTokens || 0) + Number(u.cacheWriteTokens || 0),
      tokensCached: Number(u.cacheReadTokens || 0),
      tokensOut: Number(u.outputTokens || 0),
    };
  }
  return null;
}

export class CliAdapter implements Adapter {
  kind = "cli" as const;
  modes: Mode[];
  id: string;
  private pc: ProviderConfig;

  constructor(id: string, pc: ProviderConfig) {
    this.id = id;
    this.pc = pc;
    this.modes = Object.keys(pc.run || {}) as Mode[];
  }

  async available() {
    return !!this.pc.command && commandExists(this.pc.command);
  }

  async discover(): Promise<ModelInfo[]> {
    const found = new Map<string, Partial<ModelInfo>>();
    for (const m of this.pc.models || []) found.set(m.model, m);
    const d = this.pc.discover;
    const re = d?.match ? new RegExp(d.match, "gim") : null;
    if (d?.url) {
      const text = await fetch(d.url, { signal: AbortSignal.timeout(30_000) }).then((r) => r.text()).catch(() => "");
      for (const id of new Set(re ? text.match(re) || [] : [])) if (!found.has(id)) found.set(id, {});
    }
    if (d?.cmd) {
      const r = await shell(d.cmd, { cwd: process.cwd(), timeoutMs: 120_000 });
      for (const line of stripAnsi(r.out).split("\n").map((s) => s.trim())) {
        if (!line || (re && !new RegExp(d.match!, "i").test(line))) continue;
        if (!found.has(line)) found.set(line, {});
      }
    }
    return [...found.entries()].map(([model, m]) => ({
      key: `${this.id}:${model}`,
      adapter: this.id,
      model,
      tier: m.tier!,
      free: this.pc.billing === "free",
      contextLength: m.contextLength,
      priceIn: m.priceIn,
      priceOut: m.priceOut,
      modes: this.modes,
    }));
  }

  async run(req: RunRequest): Promise<RunResult> {
    const template = this.pc.run?.[req.mode];
    if (!template) throw new Error(`${this.id} has no ${req.mode} command`);
    if (this.pc.prestart) await prestart(this.pc.prestart, this.pc.poststop);
    const base = req.logFile.replace(/\.log$/, "");
    const promptFile = posix(`${base}.prompt.txt`);
    const outFile = posix(`${base}.out.txt`);
    fs.writeFileSync(promptFile, req.prompt);
    const q = (s: string) => s.replace(/'/g, "");
    const line = template
      .replaceAll("{model}", req.model)
      .replaceAll("{promptFile}", promptFile)
      .replaceAll("{outFile}", outFile)
      .replaceAll("{timeoutSec}", String(Math.round(req.timeoutMs / 1000)))
      .replaceAll("{title}", q(req.title))
      .replaceAll("{cwd}", posix(req.cwd))
      .replaceAll("{root}", posix(ROOT));
    fs.writeFileSync(req.logFile, `$ ${line}\n\n`);
    const r = await shell(line, {
      cwd: req.cwd,
      timeoutMs: req.timeoutMs,
      idleMs: req.idleMs,
      watchMs: req.watchMs,
      onWatch: req.onWatch,
      killMarkers: req.killMarkers,
      logFile: req.logFile,
      env: this.pc.isolateGit ? { GIT_DIR: FAKE_GIT, GIT_WORK_TREE: FAKE_GIT } : {},
    });

    let text = "";
    let tokensIn = 0;
    let tokensCached = 0;
    let tokensOut = 0;
    let costUsd = 0;
    let isError = false;
    if (this.pc.parse === "claude-json") {
      const json = stripAnsi(r.out).split("\n").reverse().find((l) => l.trim().startsWith("{") && l.includes('"result"'));
      if (json) {
        try {
          const o = JSON.parse(json);
          text = String(o.result ?? "");
          isError = !!o.is_error;
          costUsd = Number(o.total_cost_usd || 0);
          const u = o.usage || {};
          tokensIn = Number(u.input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
          tokensCached = Number(u.cache_read_input_tokens || 0);
          tokensOut = Number(u.output_tokens || 0);
        } catch {
          /* fall through to report file */
        }
      }
    } else if (this.pc.parse === "commandcode-json") {
      const cc = parseCommandCode(r.out);
      if (cc) {
        text = cc.text;
        isError = cc.isError;
        tokensIn = cc.tokensIn;
        tokensCached = cc.tokensCached;
        tokensOut = cc.tokensOut;
        // classify reads the output tail, so the real error has to be in there
        if (cc.isError) r.out += "\n" + cc.error;
      }
    } else if (this.pc.parse === "out-file") {
      text = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";
    } else {
      text = stripAnsi(r.out);
      if (this.pc.answerAfter) {
        const parts = text.split(new RegExp(this.pc.answerAfter, "m"));
        if (parts.length > 1) text = parts[parts.length - 1];
      }
      text = text.trim().slice(-20_000);
    }
    // the report file the agent wrote wins over whatever it printed
    const reportPath = path.join(req.cwd, REPORT_NAME);
    if (fs.existsSync(reportPath)) {
      text = fs.readFileSync(reportPath, "utf8");
      fs.rmSync(reportPath);
    }
    const hasAnswer = text.trim().length > 20 && !isError && !isErrorOnly(text);
    const failure = r.stalled && !hasAnswer ? "stalled" : classify(r.out, isError ? 1 : r.code, r.timedOut, r.ms, hasAnswer);
    return { ok: !failure, text, exitCode: r.code, latencyMs: r.ms, tokensIn, tokensCached, tokensOut, costUsd, failure };
  }
}
