import os from "node:os";
import path from "node:path";
import type { Category, Mode, Terse, Tier } from "./types.ts";
import { ROOT, readJson } from "./util.ts";

export interface ProviderConfig {
  kind: "cli" | "api" | "mock" | "openhands";
  enabled: boolean;
  billing: "free" | "subscription" | "metered";
  command?: string;
  isolateGit?: boolean;
  streamsOutput?: boolean; // false: prints only at the end, so no stall detection
  parse?: "text" | "claude-json" | "commandcode-json" | "out-file";
  answerAfter?: string;
  prestart?: string; // run once per process from ~/.orch before the first run, e.g. start a shared daemon outside any worktree
  poststop?: string; // run when the engine process exits, after a prestart: stop that daemon so it does not outlive the run
  run?: Partial<Record<Mode, string>>;
  models?: { model: string; tier?: Tier; contextLength?: number; priceIn?: number; priceOut?: number }[];
  discover?: { url?: string; cmd?: string; match?: string; ollama?: string };
  baseUrl?: string;
  apiKeyEnv?: string;
  freeOnly?: boolean;
  // openhands: agent CLIs driven over ACP; key = provider id of the backend
  backends?: Record<string, { command: string; env?: string; modes: Partial<Record<Mode, string>>; warmupSec?: number }>;
}

export interface Config {
  vault: string;
  worktreeRoot: string;
  senior: { model: string; fallback: string[]; timeoutMin: number };
  terse: Terse;
  budget: { perRunUsd: number; perTaskUsd: number };
  limits: { maxAttempts: number; maxSameModel: number; reassignsBeforeTierUp: number; maxNodeVisits: number; idleMin?: number; watchMin?: number };
  router: {
    weights: Record<"benchmark" | "correctness" | "tools" | "context" | "latency" | "cost", number>;
    prior: number;
    priorWeight: number;
    /** Score bonus for models with few runs in the category, on low-risk tasks only (shrinks as 1/(1+runs)); 0 = off. */
    exploreLowRisk?: number;
    premium: "never" | "escalation" | "always";
    latencyTargetSec: Record<Category, number>;
    modelsTtlHours: number;
    exclude: string[];
    tiers: { strong: string[]; light: string[] };
    cooldownMin: Record<string, number>;
  };
  providers: Record<string, ProviderConfig>;
  graphify: { command: string };
}

function merge(a: any, b: any): any {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out && typeof out[k] === "object" && !Array.isArray(out[k]) ? merge(out[k], v) : v;
  return out;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const base = readJson<Config>(path.join(ROOT, "config", "orchestrator.json"), {} as Config);
  const local = readJson<Partial<Config>>(path.join(ROOT, "config", "local.json"), {});
  // ORCH_CONFIG: an extra overrides file (test servers, other machines)
  const extra = process.env.ORCH_CONFIG ? readJson<Partial<Config>>(path.resolve(process.env.ORCH_CONFIG), {}) : {};
  const cfg = merge(merge(merge(base, local), extra), overrides) as Config;
  const expand = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : path.isAbsolute(p) ? p : path.join(ROOT, p));
  cfg.vault = expand(process.env.ORCH_VAULT || cfg.vault);
  cfg.worktreeRoot = expand(cfg.worktreeRoot);
  return cfg;
}
