// Benchmark runner: random tasks from benchmarks/, each given to the models the
// router knows least about (exploration), scored from engine evidence only.
// Results land in vault/Executions (source: benchmark) and vault/Benchmarks/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Engine } from "./engine.ts";
import type { Check, Project, RunState, Task } from "./types.ts";
import { ENGINE, git, now, posix, shell, slug, writeText } from "./util.ts";

export interface Bench {
  id: string;
  title: string;
  category: Task["category"];
  risk: Task["risk"];
  brief: string;
  files: string[];
  checks: Check[];
  reportMatch?: string[];
  dir: string;
}

export function loadBenchmarks(): Bench[] {
  const root = path.join(ENGINE, "benchmarks");
  return fs
    .readdirSync(root)
    .filter((d) => fs.existsSync(path.join(root, d, "bench.json")))
    .map((d) => ({ ...JSON.parse(fs.readFileSync(path.join(root, d, "bench.json"), "utf8")), dir: path.join(root, d) }));
}

/** Fresh git repo with the fixture committed on main. */
function fixture(b: Bench, dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(b.dir, "repo"), dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", ".");
  git(dir, "-c", "user.name=bench", "-c", "user.email=bench@local", "commit", "-qm", "fixture");
}

const lastNumber = (s: string) => {
  const m = s.match(/-?\d+(?:\.\d+)?/g);
  return m ? Number(m[m.length - 1]) : undefined;
};

/** Proves every benchmark is fair: the fixture fails its checks and the reference solution passes. */
export async function selftest(): Promise<{ id: string; ok: boolean; note: string }[]> {
  const out = [];
  for (const b of loadBenchmarks()) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bench-self-${b.id}-`));
    fixture(b, dir);
    let ok = true;
    const notes: string[] = [];
    if (b.files.length) {
      const before: Record<string, { code: number | null; v?: number }> = {};
      for (const c of b.checks) {
        const r = await shell(c.cmd, { cwd: dir, timeoutMs: 120_000 });
        before[c.name] = { code: r.code, v: lastNumber(r.out) };
      }
      if (b.checks.filter((c) => !c.measure).every((c) => before[c.name].code === 0)) {
        ok = false;
        notes.push("fixture already passes");
      }
      fs.cpSync(path.join(b.dir, "solution"), dir, { recursive: true });
      for (const c of b.checks) {
        const r = await shell(c.cmd, { cwd: dir, timeoutMs: 120_000 });
        const v = lastNumber(r.out);
        let pass = r.code === 0;
        if (pass && c.measure && v !== undefined && before[c.name].v !== undefined) pass = c.expect === "higher" ? v > before[c.name].v! : v < before[c.name].v!;
        if (!pass) {
          ok = false;
          notes.push(`solution fails ${c.name}: ${r.out.trim().split("\n").slice(-3).join(" / ")}`);
        }
      }
    } else {
      const good = fs.readFileSync(path.join(b.dir, "solution", "report.md"), "utf8");
      const miss = (b.reportMatch ?? []).filter((re) => !new RegExp(re, "i").test(good));
      if (miss.length) {
        ok = false;
        notes.push(`reference report misses ${miss.join(", ")}`);
      }
      if ((b.reportMatch ?? []).every((re) => new RegExp(re, "i").test("I looked at the code and it seems fine."))) {
        ok = false;
        notes.push("a useless report would pass");
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
    out.push({ id: b.id, ok, note: notes.join("; ") || (b.files.length ? "fixture fails, solution passes" : "report patterns sound") });
  }
  return out;
}

/** Small seeded RNG so a benchmark draw can be repeated. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export interface BenchOptions {
  random?: number; // how many tasks to draw
  tasks?: string[]; // explicit task ids
  perTask: number; // models per task
  models?: string[]; // explicit model keys
  adapters?: string[]; // only these providers
  parallel: number;
  seed: number;
  premium: boolean;
  timeoutMin: number;
}

export async function runBenchmarks(engine: Engine, o: BenchOptions, print: (s: string) => void) {
  const all = loadBenchmarks();
  const rand = rng(o.seed);
  let pool = o.tasks?.length ? all.filter((b) => o.tasks!.includes(b.id)) : [...all];
  if (!o.tasks?.length) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool = pool.slice(0, o.random ?? 3);
  }
  const agents = engine.agents();
  const benchRuns = engine.vault.executions().filter((e) => e.source === "benchmark");

  // pick models per task: least benchmarked on that category first (explore), random tie-break
  const jobs: { b: Bench; model: string }[] = [];
  for (const b of pool) {
    let models = o.models;
    if (!models?.length) {
      const p = agents[b.category];
      const { candidates } = await engine.router.rank({
        category: b.category, mode: p.mode, risk: "low", minTier: p.minTier, exclude: [],
        contextNeeded: 8000, budgetUsd: engine.cfg.budget.perTaskUsd, escalated: o.premium,
      });
      models = candidates
        .map((c) => c.key)
        .filter((k) => !o.adapters?.length || o.adapters.includes(k.split(":")[0]))
        .filter((k) => engine.models.billing(k) === "free" || o.premium)
        .map((k) => ({ k, n: benchRuns.filter((e) => e.model === k && e.category === b.category).length, r: rand() }))
        .sort((x, y) => x.n - y.n || x.r - y.r)
        .slice(0, o.perTask)
        .map((x) => x.k);
    }
    for (const model of models) jobs.push({ b, model });
  }
  if (!jobs.length) throw new Error("no models to benchmark (check `orch models`)");
  print(`benchmark: ${jobs.length} job(s)\n${jobs.map((j) => `  ${j.b.id.padEnd(16)} ${j.b.category.padEnd(10)} ${j.model}`).join("\n")}\n`);

  const stamp = now().slice(0, 16).replace(/[:T]/g, "-");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-bench-"));
  const results: { b: Bench; model: string; s?: RunState; err?: string }[] = [];
  const busy = new Set<string>(); // one job per provider at a time: free tiers share quotas
  const started = jobs.map(() => false);
  let running = 0;
  let finished = 0;
  await new Promise<void>((done) => {
    const pump = () => {
      if (finished === jobs.length) return done();
      for (let n = 0; n < jobs.length && running < o.parallel; n++) {
        const j = jobs[n];
        const adapter = engine.models.quota(j.model);
        if (started[n] || busy.has(adapter)) continue;
        started[n] = true;
        busy.add(adapter);
        running++;
        const repo = path.join(tmp, `${n}-${j.b.id}`);
        fixture(j.b, repo);
        const project: Project = { name: `bench-${j.b.id}`, repo: posix(repo), baseBranch: "main", allowedCommands: [""], linkDirs: [], context: "" };
        const task: Task = {
          id: j.b.id, title: j.b.title, category: j.b.category, risk: j.b.risk, brief: j.b.brief, files: j.b.files, deps: [],
          checks: j.b.checks, status: "pending", attempts: [], excluded: [], reassigns: 0, forceModel: j.model, reportMatch: j.b.reportMatch, timeoutMin: o.timeoutMin,
        };
        const id = `bench-${stamp}-${n}-${j.b.id}-${slug(j.model).slice(0, 30)}`;
        print(`start  ${j.b.id} on ${j.model}`);
        engine
          .startWith({ project, request: `Benchmark ${j.b.id} on ${j.model}`, workflow: "bench", tasks: [task], id })
          .then((s) => {
            results.push({ b: j.b, model: j.model, s });
            print(`done   ${j.b.id} on ${j.model}: ${s.tasks[0].attempts[0]?.reason ?? s.error ?? s.tasks[0].status}`);
          })
          .catch((e) => {
            results.push({ b: j.b, model: j.model, err: String(e) });
            print(`error  ${j.b.id} on ${j.model}: ${e}`);
          })
          .finally(() => {
            busy.delete(adapter);
            running--;
            finished++;
            pump();
          });
      }
    };
    pump();
  });
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Windows may still hold a handle; temp is cleaned by the OS */
  }

  const rows = results.map((r) => {
    const a = r.s?.tasks[0].attempts[0];
    const pass = r.s?.tasks[0].status === "accepted";
    return { ...r, pass, sec: a ? Math.round(a.latencyMs / 1000) : 0, reason: a?.reason ?? r.err ?? r.s?.error ?? "no attempt" };
  });
  const body = [
    `# Benchmark ${stamp}`,
    `${rows.filter((r) => r.pass).length}/${rows.length} passed. Seed ${o.seed}.`,
    "| Task | Category | Model | Result | Time s | Run |\n|---|---|---|---|---|---|\n" +
      rows.map((r) => `| ${r.b.id} | ${r.b.category} | [[Models/${r.model.replace(/[:/\\]+/g, "--").replace(/[^A-Za-z0-9._-]/g, "_")}\\|${r.model}]] | ${r.pass ? "PASS" : "FAIL"} | ${r.sec} | ${r.s ? `[[Runs/${r.s.id}/index\\|run]]` : "-"} |`).join("\n"),
    "## Details\n\n" + rows.map((r) => `- ${r.b.id} / ${r.model}: ${r.reason}`).join("\n"),
  ].join("\n\n");
  writeText(engine.vault.p("Benchmarks", `${stamp}.md`), `---\ntype: benchmark\ndate: ${now()}\nseed: ${o.seed}\n---\n\n${body}\n`);
  return rows;
}
