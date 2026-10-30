// Provider registry + live model list + model health (cooldowns).
import { ApiAdapter } from "./adapters/api.ts";
import { CliAdapter } from "./adapters/cli.ts";
import { MockAdapter } from "./adapters/mock.ts";
import { OpenHandsAdapter } from "./adapters/openhands.ts";
import type { Config } from "./config.ts";
import type { Adapter, Failure, ModelInfo, Tier } from "./types.ts";
import { now, readJson, writeJson } from "./util.ts";
import type { Vault } from "./vault.ts";

export class Models {
  readonly adapters = new Map<string, Adapter>();
  private cfg: Config;
  private vault: Vault;

  constructor(cfg: Config, vault: Vault) {
    this.cfg = cfg;
    this.vault = vault;
    for (const [id, pc] of Object.entries(cfg.providers)) {
      if (!pc.enabled) continue;
      if (pc.kind === "cli") this.adapters.set(id, new CliAdapter(id, pc));
      else if (pc.kind === "api") this.adapters.set(id, new ApiAdapter(id, pc));
      else if (pc.kind === "mock") this.adapters.set(id, new MockAdapter());
    }
    // OpenHands drives the CLIs above over ACP, so it is built after them
    for (const [id, pc] of Object.entries(cfg.providers)) {
      if (!pc.enabled || pc.kind !== "openhands") continue;
      const backends = Object.keys(pc.backends || {})
        .filter((b) => cfg.providers[b]?.kind === "cli")
        .map((b) => ({ id: b, pc: cfg.providers[b], adapter: new CliAdapter(b, cfg.providers[b]) }));
      this.adapters.set(id, new OpenHandsAdapter(id, pc, backends));
    }
  }

  /** Provider config that bills and rate-limits this model: for OpenHands keys, the ACP backend's. */
  private provider(key: string) {
    const [id, model] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    const pc = this.cfg.providers[id];
    return pc?.kind === "openhands" ? { id: model.split("/")[0], pc: this.cfg.providers[model.split("/")[0]] ?? pc } : { id, pc };
  }
  /** Free tiers share a quota per backend, so jobs on the same quota should not run in parallel. */
  quota(key: string) {
    return this.provider(key).id;
  }

  adapter(key: string): Adapter {
    const a = this.adapters.get(key.split(":")[0]);
    if (!a) throw new Error(`no enabled adapter for ${key}`);
    return a;
  }
  billing(key: string) {
    return this.provider(key).pc?.billing ?? "free";
  }

  tierOf(model: string, given?: Tier): Tier {
    if (given) return given;
    const t = this.cfg.router.tiers;
    if (t.strong.some((p) => model.includes(p))) return "strong";
    if (t.light.some((p) => model.includes(p))) return "light";
    return "standard";
  }
  excluded(model: string) {
    return this.cfg.router.exclude.some((p) => new RegExp(p, "i").test(model));
  }

  /** Live models, cached for modelsTtlHours. Adapters that are not installed or have no key are skipped. */
  async list(refresh = false): Promise<{ refreshed: string; models: ModelInfo[]; skipped: string[] }> {
    const file = this.vault.state("models.json");
    const cached = readJson<{ refreshed: string; models: ModelInfo[]; skipped: string[]; adapters: string[] } | null>(file, null);
    const ids = [...this.adapters.keys()].sort().join(",");
    const fresh = cached && cached.adapters?.join(",") === ids && Date.now() - Date.parse(cached.refreshed) < this.cfg.router.modelsTtlHours * 3600_000;
    if (!refresh && fresh) return cached!;
    const models: ModelInfo[] = [];
    const skipped: string[] = [];
    await Promise.all(
      [...this.adapters.values()].map(async (a) => {
        if (!(await a.available())) return skipped.push(`${a.id} (not installed or no key)`);
        try {
          for (const m of await a.discover()) {
            if (this.excluded(m.model)) continue;
            models.push({ ...m, tier: this.tierOf(m.model, m.tier) });
          }
        } catch (e) {
          skipped.push(`${a.id} (discover failed: ${(e as Error).message})`);
        }
      }),
    );
    models.sort((a, b) => a.key.localeCompare(b.key));
    const reg = { refreshed: now(), models, skipped, adapters: ids.split(",") };
    writeJson(file, reg);
    return reg;
  }

  async info(key: string): Promise<ModelInfo | undefined> {
    return (await this.list()).models.find((m) => m.key === key);
  }

  /* ---- health: cooldown after a tool failure; history goes to the model note ---- */
  health(): Record<string, { reason: string; until: string }> {
    return readJson(this.vault.state("health.json"), {});
  }
  coolingDown(key: string) {
    const h = this.health()[key];
    return h && Date.parse(h.until) > Date.now() ? h : null;
  }
  markFailure(key: string, reason: Failure) {
    const h = this.health();
    const mins = this.cfg.router.cooldownMin[reason] ?? 15;
    const until = new Date(Date.now() + mins * 60_000).toISOString();
    h[key] = { reason, until };
    writeJson(this.vault.state("health.json"), h);
    this.vault.modelEvent(key, `cooldown ${reason} until ${until.slice(0, 16)}`);
  }
}
