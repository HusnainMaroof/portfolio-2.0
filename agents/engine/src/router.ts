// Model router. For one task it answers: which live model is best for THIS kind of
// task in THIS environment? It filters (mode, tier, cooldown, context, budget,
// excluded) and ranks by six weighted signals learned from the vault's execution records.
import type { Config } from "./config.ts";
import type { Models } from "./models.ts";
import { TIERS, type Category, type Mode, type ModelInfo, type Risk, type Tier } from "./types.ts";
import type { Execution, Vault } from "./vault.ts";
import { INFRA_FAILURES } from "./adapters/common.ts";

export interface RouteRequest {
  category: Category;
  mode: Mode;
  risk: Risk;
  minTier: Tier;
  exclude: string[];
  contextNeeded: number; // tokens
  budgetUsd: number;
  escalated: boolean; // allows premium when router.premium = "escalation"
}

export interface Candidate {
  key: string;
  score: number;
  why: string;
  parts: Record<string, number>;
}

const tierIndex = (t: Tier) => TIERS.indexOf(t);

export class Router {
  private cfg: Config;
  private models: Models;
  private vault: Vault;

  constructor(cfg: Config, models: Models, vault: Vault) {
    this.cfg = cfg;
    this.models = models;
    this.vault = vault;
  }

  /** (sum + prior*k) / (n + k): untested models start at the prior, proven ones move away from it. */
  private shrink(values: number[], prior: number) {
    const k = this.cfg.router.priorWeight;
    return (values.reduce((a, b) => a + b, 0) + prior * k) / (values.length + k);
  }

  async rank(req: RouteRequest): Promise<{ candidates: Candidate[]; dropped: Record<string, number> }> {
    const { models } = await this.models.list();
    const rc = this.cfg.router;
    const all = this.vault.executions();
    const dropped: Record<string, number> = {};
    const drop = (why: string) => (dropped[why] = (dropped[why] || 0) + 1);
    const needTier = req.risk === "high" ? TIERS[Math.max(tierIndex(req.minTier), tierIndex("strong"))] : req.minTier;
    const premiumOk = rc.premium === "always" || (rc.premium === "escalation" && req.escalated);
    const out: Candidate[] = [];

    for (const m of models) {
      if (req.exclude.includes(m.key)) { drop("excluded for this task"); continue; }
      if (!m.modes.includes(req.mode)) { drop(`no ${req.mode} mode`); continue; }
      if (tierIndex(m.tier) < tierIndex(needTier)) { drop(`below tier ${needTier}`); continue; }
      if (m.tier === "premium" && !premiumOk) { drop("premium held for escalation"); continue; }
      if (this.models.coolingDown(m.key)) { drop("cooling down"); continue; }
      if (m.contextLength && m.contextLength < req.contextNeeded) { drop("context too small"); continue; }
      const billing = this.models.billing(m.key);
      const est = estCost(m, req.contextNeeded);
      if (billing === "metered" && est > req.budgetUsd) { drop("over budget"); continue; }

      const mine = all.filter((e) => e.model === m.key);
      // provider outages (quota, auth, model not served) say nothing about skill: only the tools signal sees them
      const judged = mine.filter((e) => !INFRA_FAILURES.includes(e.toolFailure));
      // a review "succeeds" when it returns valid JSON: that says nothing about the model's skill at other work
      const work = judged.filter((e) => e.source !== "benchmark" && (e.category !== "review" || req.category === "review"));
      const cat = (xs: Execution[]) => xs.filter((e) => e.category === req.category);
      const benchRows = judged.filter((e) => e.source === "benchmark");
      const benchAll = this.shrink(benchRows.map((e) => (e.success ? 1 : 0)), rc.prior);
      const benchCat = this.shrink(cat(benchRows).map((e) => (e.success ? 1 : 0)), benchAll);
      const quality = (e: Execution) => (e.success ? 1 : e.checksPassed ? 0.5 : 0);
      const corrAll = this.shrink(work.map(quality), rc.prior);
      const corrCat = this.shrink(cat(work).map(quality), corrAll);
      const tools = 1 - this.shrink(mine.map((e) => (e.toolFailure ? 1 : 0)), 0.1);
      // unknown context is near-neutral: many free endpoints do not publish it
      const context = m.contextLength ? Math.min(1, m.contextLength / (req.contextNeeded * 2)) : 0.75;
      const timed = judged.filter((e) => e.latencySec > 0);
      const lat = median(cat(timed).map((e) => e.latencySec)) ?? median(timed.map((e) => e.latencySec));
      const target = rc.latencyTargetSec[req.category] ?? 300;
      const latency = lat === undefined ? 0.5 : target / (target + lat);
      const cost = billing === "free" ? 1 : billing === "subscription" ? 0.6 : Math.max(0, 1 - est / Math.max(req.budgetUsd, 1e-6));
      const parts = { benchmark: benchCat, correctness: corrCat, tools, context, latency, cost };
      const w = rc.weights;
      const wsum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
      let score = Object.entries(parts).reduce((a, [k, v]) => a + (w[k as keyof typeof w] ?? 0) * v, 0) / wsum;
      score += 0.005 * tierIndex(m.tier); // tie-break toward the stronger model
      const nCat = cat(work).length;
      // without this, untested models sit at the prior forever and one proven model takes every task;
      // low-risk tasks are cheap to retry, so they try the less-known models
      const explore = req.risk === "low" && !req.escalated ? (rc.exploreLowRisk ?? 0) / (1 + nCat) : 0;
      score += explore;
      out.push({
        key: m.key,
        score: +score.toFixed(4),
        parts,
        why: `bench ${cat(benchRows).filter((e) => e.success).length}/${cat(benchRows).length} ${req.category}, ${benchRows.filter((e) => e.success).length}/${benchRows.length} all; ${nCat} ${req.category} / ${work.length} real runs; tier ${m.tier}, ${billing}${lat !== undefined ? `, ~${Math.round(lat)}s` : ""}${explore ? `, explore +${explore.toFixed(3)}` : ""}`,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return { candidates: out, dropped };
  }
}

function estCost(m: ModelInfo, ctx: number) {
  return ((m.priceIn || 0) * ctx + (m.priceOut || 0) * 4000) / 1e6;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
