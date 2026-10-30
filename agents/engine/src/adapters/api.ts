// OpenAI-compatible chat API: OpenAI, OpenRouter, Ollama, LM Studio, vLLM, ...
// API models cannot touch files, so in edit mode they answer with file blocks
// (see common.ts) and this adapter writes them, limited to the allowed files.
import fs from "node:fs";
import type { ProviderConfig } from "../config.ts";
import type { Adapter, ModelInfo, Mode, RunRequest, RunResult } from "../types.ts";
import { applyFileBlocks, classify } from "./common.ts";

export class ApiAdapter implements Adapter {
  kind = "api" as const;
  modes: Mode[] = ["readonly", "edit"];
  id: string;
  private pc: ProviderConfig;
  private prices = new Map<string, { in: number; out: number }>();

  constructor(id: string, pc: ProviderConfig) {
    this.id = id;
    this.pc = pc;
  }

  private key() {
    return this.pc.apiKeyEnv ? process.env[this.pc.apiKeyEnv] : undefined;
  }

  async available() {
    if (this.pc.apiKeyEnv && !this.key()) return false;
    if (this.pc.discover?.ollama)
      return fetch(this.pc.discover.ollama, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
    return true;
  }

  async discover(): Promise<ModelInfo[]> {
    const out: ModelInfo[] = [];
    const add = (model: string, extra: Partial<ModelInfo>) =>
      out.push({ key: `${this.id}:${model}`, adapter: this.id, model, tier: extra.tier!, free: this.pc.billing === "free", modes: this.modes, ...extra });
    for (const m of this.pc.models || []) add(m.model, { ...m, free: this.pc.billing === "free" });
    const d = this.pc.discover;
    if (d?.url) {
      // OpenRouter-style /models: id, context_length, pricing per token (strings)
      const res = await fetch(d.url, { signal: AbortSignal.timeout(30_000) }).then((r) => r.json()).catch(() => null);
      for (const m of (res?.data || []) as any[]) {
        const pin = Number(m.pricing?.prompt ?? NaN) * 1e6;
        const pout = Number(m.pricing?.completion ?? NaN) * 1e6;
        const free = String(m.id).endsWith(":free") || (pin === 0 && pout === 0);
        if (this.pc.freeOnly && !free) continue;
        const text = (m.architecture?.output_modalities || ["text"]) as string[];
        if (!text.includes("text")) continue;
        if (!free) this.prices.set(m.id, { in: pin, out: pout });
        add(m.id, { free, contextLength: Number(m.context_length) || undefined, priceIn: pin || 0, priceOut: pout || 0 });
      }
    }
    if (d?.ollama) {
      const res = await fetch(d.ollama, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null);
      for (const m of (res?.models || []) as any[]) add(m.name, { free: true });
    }
    return out;
  }

  async run(req: RunRequest): Promise<RunResult> {
    const started = Date.now();
    const headers: Record<string, string> = { "content-type": "application/json" };
    const key = this.key();
    if (key) headers.authorization = `Bearer ${key}`;
    const body: Record<string, unknown> = { model: req.model, messages: [{ role: "user", content: req.prompt }] };
    if (this.pc.baseUrl?.includes("openrouter")) body.usage = { include: true };
    fs.writeFileSync(req.logFile, `POST ${this.pc.baseUrl}/chat/completions model=${req.model}\n\n--- prompt ---\n${req.prompt}\n`);
    let status = 0;
    let raw = "";
    let timedOut = false;
    try {
      const res = await fetch(`${this.pc.baseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(req.timeoutMs) });
      status = res.status;
      raw = await res.text();
    } catch (e) {
      timedOut = (e as Error).name === "TimeoutError";
      raw = String(e);
    }
    fs.appendFileSync(req.logFile, `\n--- response ${status} ---\n${raw}\n`);
    let text = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;
    try {
      const o = JSON.parse(raw);
      text = String(o.choices?.[0]?.message?.content ?? "");
      tokensIn = Number(o.usage?.prompt_tokens || 0);
      tokensOut = Number(o.usage?.completion_tokens || 0);
      const p = this.prices.get(req.model);
      costUsd = Number(o.usage?.cost ?? (p ? (tokensIn * p.in + tokensOut * p.out) / 1e6 : 0));
    } catch {
      /* raw holds the error */
    }
    let filesWritten: string[] | undefined;
    if (req.mode === "edit" && text) {
      const r = applyFileBlocks(text, req.cwd, req.allowedFiles || []);
      filesWritten = r.written;
      text = r.rest + (r.rejected.length ? `\n\nNOTE (engine): rejected writes outside the allowed files: ${r.rejected.join(", ")}` : "");
    }
    const ms = Date.now() - started;
    const hasAnswer = text.trim().length > 20 || !!filesWritten?.length;
    const failure = status >= 200 && status < 300 ? classify("", 0, false, ms, hasAnswer) : classify(`${status} ${raw}`, 1, timedOut, ms, false);
    return { ok: !failure, text, exitCode: status, latencyMs: ms, tokensIn, tokensOut, costUsd, failure, filesWritten };
  }
}
