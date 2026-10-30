// OpenHands as the agent runtime. OpenHands (SDK, LocalWorkspace, no Docker) runs the
// conversation, events, stuck detection and usage metrics; the agent itself is one of
// our CLIs spoken to over ACP (`opencode acp`, `kilo acp`, `cline --acp`), using that
// CLI's own login and models. Model keys: "openhands:<backend>/<backend model>".
import type { ProviderConfig } from "../config.ts";
import type { Adapter, ModelInfo, Mode, RunRequest, RunResult } from "../types.ts";
import { commandExists, ENGINE, posix } from "../util.ts";
import fs from "node:fs";
import { CliAdapter } from "./cli.ts";
import { INFRA_FAILURES } from "./common.ts";

export interface Backend {
  id: string;
  pc: ProviderConfig; // the backend's own provider entry (discovery, billing, git isolation)
  adapter: CliAdapter;
}

export class OpenHandsAdapter implements Adapter {
  kind = "cli" as const;
  modes: Mode[] = ["readonly", "edit"];
  id: string;
  private pc: ProviderConfig;
  private backends: Backend[];

  constructor(id: string, pc: ProviderConfig, backends: Backend[]) {
    this.id = id;
    this.pc = pc;
    this.backends = backends.filter((b) => pc.backends?.[b.id]);
  }

  private backend(model: string) {
    const id = model.split("/")[0];
    const b = this.backends.find((x) => x.id === id);
    if (!b) throw new Error(`${this.id}: no ACP backend "${id}" (enable it in providers.${this.id}.backends)`);
    return b;
  }

  async available() {
    return !!this.pc.command && commandExists(this.pc.command) && this.backends.length > 0;
  }

  async discover(): Promise<ModelInfo[]> {
    const out: ModelInfo[] = [];
    for (const b of this.backends) {
      if (!(await b.adapter.available())) continue;
      const modes = Object.keys(this.pc.backends![b.id].modes) as Mode[];
      for (const m of await b.adapter.discover())
        out.push({ ...m, key: `${this.id}:${b.id}/${m.model}`, adapter: this.id, model: `${b.id}/${m.model}`, modes });
    }
    return out;
  }

  async run(req: RunRequest): Promise<RunResult> {
    const b = this.backend(req.model);
    const acp = this.pc.backends![b.id];
    const mode = acp.modes[req.mode];
    if (!mode) throw new Error(`${this.id}/${b.id} has no ${req.mode} mode`);
    const idleSec = Math.round((req.idleMs ?? req.timeoutMs) / 1000);
    const script = posix(`${ENGINE}/scripts/openhands_agent.py`);
    const line =
      `${acp.env ? acp.env + " " : ""}"${this.pc.command}" -I '${script}' --acp '${acp.command}' --model '{model}'` +
      ` --session-mode '${mode}' --cwd '{cwd}' --prompt-file '{promptFile}' --idle-sec ${idleSec}${acp.warmupSec ? ` --warmup-sec ${acp.warmupSec}` : ""} --title '{title}' < /dev/null`;
    // the CLI adapter runs it: logging, stall/kill handling, JSON result, report file, failure class
    const runner = new CliAdapter(this.id, { ...this.pc, kind: "cli", isolateGit: b.pc.isolateGit, prestart: b.pc.prestart, poststop: b.pc.poststop, parse: "claude-json", run: { [req.mode]: line } });
    const model = req.model.slice(b.id.length + 1);
    const r = await runner.run({ ...req, model });
    return r.failure === "no_response" ? this.probe(b, model, req, r) : r;
  }

  // Cline over ACP drops the provider's error (a 429 daily cap, a retired model) and just answers
  // nothing. One tiny turn through the backend's own CLI shows the real error, so the cooldown fits it.
  private async probe(b: Backend, model: string, req: RunRequest, r: RunResult): Promise<RunResult> {
    if (!b.pc.run?.readonly) return r;
    const p = await b.adapter.run({
      model,
      mode: "readonly",
      prompt: "Reply with the single word OK. Do not use any tools.",
      cwd: req.cwd,
      timeoutMs: 90_000,
      logFile: req.logFile.replace(/\.log$/, ".probe.log"),
      title: `${req.title} probe`,
      killMarkers: req.killMarkers,
    });
    if (!p.failure || !INFRA_FAILURES.includes(p.failure) || p.failure === "no_response") return r;
    fs.appendFileSync(req.logFile, `\nprobe through ${b.id}: ${p.failure}\n`);
    return { ...r, failure: p.failure };
  }
}
