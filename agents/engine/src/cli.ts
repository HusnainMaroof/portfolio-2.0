#!/usr/bin/env node
// orch: command line for the orchestrator engine.
import fs from "node:fs";
import path from "node:path";
import { Engine, validate } from "./engine.ts";
import { checkBatch, mergeRun, runSummary } from "./ship.ts";
import { NODE_TYPES } from "./nodes/index.ts";
import { buildCodeGraph } from "./graph.ts";
import { runBenchmarks, selftest } from "./bench.ts";
import { CATEGORIES, type Category, type Mode, type Risk, type RunState, type Tier } from "./types.ts";
import { git, now, readJson, ROOT, shell } from "./util.ts";

const HELP = `orch: a senior model managing a team of coding agents

  orch setup [--openhands] [--freebuff]  first step after a clone: local config, Claude Code skills,
                                         which agent CLIs are installed (nothing to npm install)
  orch init <repo> [--name N] [--base main] [--allow "npm test,npx tsc"] [--link node_modules]
                                         register a project (vault/Projects/N.md)
  orch run [project] "<request>" [--workflow default]
                                         start a run; it stops when it needs you. No project:
                                         the repo that holds this agents/ folder
  orch run-tasks [project] <tasks.json> ["<request>"] [--check]
                                         run preset tasks without senior planning (workflow "tasks");
                                         --check only reports approvals, file overlaps and the order
  orch resume <run> [--choice C] [--note "..."]
                                         answer a waiting run (approve, reject, accept, retry,
                                         reassign, skip, abort, answer) and continue
  orch abort <run>                       stop a run (a waiting run at once); its branches stay
  orch status [run]                      runs, or one run's tasks and what it waits for
  orch summary <run>                     one screen: tasks, evidence, question, diff stat, follow-ups, next step
  orch merge <run> [--no-test]           merge orch/<run> into the base branch; commits only if every
                                         accepted task's checks pass on the merged code (never pushes)
  orch models [--refresh]                live models per provider (tier, cooldown)
  orch route <category> [--risk low|medium|high] [--mode edit|readonly] [--tier T]
                                         router ranking with the six signals
  orch nodes [--json]                    node types (ports, params) for workflow editors
  orch workflow <name> [--json]          validate and show a workflow
  orch graph [project]                   build the Graphify code map into vault/Code/<project>
  orch bench [--random N] [--tasks a,b] [--per-task M] [--models k1,k2] [--adapters cline,kilo]
             [--parallel P] [--seed S] [--premium] [--timeout MIN]
                                         run benchmark tasks on the least-tested models (router learns)
  orch bench --selftest                  prove every benchmark fails before and passes with its solution
  orch import-scorecard <file>           import old scorecard.json attempts as execution records


Categories: ${CATEGORIES.join(", ")}`;

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const [cmd, ...args] = positional;

/**
 * The project this agents/ folder lives in (its parent repo), so `orch run "<request>"` needs no
 * project name. An existing project with that repo is reused; otherwise one is registered on first use.
 */
function hostProject(engine: Engine): string {
  const repo = path.resolve(ROOT, "..");
  if (!git(repo, "rev-parse", "--git-dir").ok) throw new Error(`${repo} is not a git repo: name a project (orch init <repo>)`);
  const dir = engine.vault.p("Projects");
  const same = (a: string) => path.resolve(a).toLowerCase() === repo.toLowerCase();
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : []) {
    const name = f.slice(0, -3);
    if (same(engine.vault.project(name).repo)) return name;
  }
  let name = path.basename(repo).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  if (fs.existsSync(path.join(dir, `${name}.md`))) name += "-here";
  engine.vault.saveProject({
    name,
    repo: repo.replace(/\\/g, "/"),
    baseBranch: git(repo, "rev-parse", "--abbrev-ref", "HEAD").out || "main",
    // the usual test and type-check commands; widen in vault/Projects/<name>.md
    allowedCommands: ["npm test", "npm run", "npx tsc"],
    linkDirs: fs.existsSync(path.join(repo, "node_modules")) ? ["node_modules"] : [],
    context: `# ${name}\n\nWrite here what the senior model should know: stack, conventions, how to test, what not to touch.`,
  });
  console.log(`project ${name}: ${repo} (registered on first use; edit vault/Projects/${name}.md)`);
  return name;
}
const isProject = (engine: Engine, name?: string) => !!name && fs.existsSync(engine.vault.p("Projects", `${name}.md`));

function printEvents(engine: Engine) {
  engine.on("event", (e) => {
    const t = new Date().toTimeString().slice(0, 8);
    if (e.type === "node:start") console.log(`${t}  > ${e.node}${e.task ? ` [${e.task}]` : ""}`);
    else if (e.type === "log") console.log(`${t}    ${e.msg}`);
    else if (e.type === "error") console.log(`${t}  ! ${e.node}: ${e.error}`);
    else if (e.type === "watch")
      console.log(`${t}    check-in ${e.agent} (${e.model}): ${e.minutes} min, ${e.newLines} new lines, ${e.repeated} repeated -> ${e.verdict}`);
  });
}

function summary(s: RunState) {
  console.log(`\nrun ${s.id}: ${s.status.toUpperCase()}  cost $${s.costUsd.toFixed(4)}`);
  for (const t of s.tasks) {
    const a = t.attempts[t.attempts.length - 1];
    console.log(`  ${t.status.padEnd(9)} ${t.id.padEnd(14)} ${t.category.padEnd(12)} ${t.risk.padEnd(6)} ${a ? `${a.model} #${a.n} ${a.decision ?? ""}` : ""}`);
  }
  if (s.waiting) {
    console.log(`\nWAITING (${s.waiting.kind}):\n${s.waiting.question}\n`);
    console.log(`answer: orch resume ${s.id} --choice <${s.waiting.options.join("|")}> [--note "..."]`);
  }
  if (s.error) console.log(`\nerror: ${s.error}`);
  console.log(`\nvault note: ${path.join("vault", "Runs", s.id, "index.md")}`);
}

async function main() {
  const engine = new Engine();
  switch (cmd) {
    case "setup": {
      // local config, Claude Code skills into ../.claude/skills, installed agent CLIs; --openhands, --freebuff
      const { main: setup } = await import("../scripts/setup.ts");
      await setup(argv);
      break;
    }
    case "init": {
      const repo = path.resolve(args[0] || "");
      if (!args[0] || !git(repo, "rev-parse", "--git-dir").ok) throw new Error("usage: orch init <path to a git repo>");
      const name = flag("--name") || path.basename(repo);
      const base = flag("--base") || git(repo, "rev-parse", "--abbrev-ref", "HEAD").out || "main";
      engine.vault.saveProject({
        name,
        repo: repo.replace(/\\/g, "/"),
        baseBranch: base,
        allowedCommands: (flag("--allow") || "").split(",").map((s) => s.trim()).filter(Boolean),
        linkDirs: (flag("--link") || "").split(",").map((s) => s.trim()).filter(Boolean),
        context: `# ${name}\n\nWrite here what the senior model should know: stack, conventions, how to test, what not to touch.`,
      });
      console.log(`project ${name}: ${repo} (base ${base}) -> vault/Projects/${name}.md`);
      break;
    }
    case "run": {
      // orch run "<request>" works on the repo that holds agents/; orch run <project> "<request>" on another
      const named = isProject(engine, args[0]) && args.length > 1;
      const project = named ? args[0] : args.length ? hostProject(engine) : "";
      const words = named ? args.slice(1) : args;
      if (!words.length) throw new Error('usage: orch run [project] "<request>"');
      printEvents(engine);
      summary(await engine.start(project, words.join(" "), flag("--workflow") || "default"));
      break;
    }
    case "run-tasks": {
      // orch run-tasks <tasks.json> works on the repo that holds agents/
      const named = !!args[0] && !args[0].endsWith(".json");
      const [project, file, ...words] = named ? args : [args[0] ? hostProject(engine) : "", ...args];
      if (!project || !file) throw new Error("usage: orch run-tasks [project] <tasks.json> [request]");
      const raw = readJson<any[]>(path.resolve(file), []);
      if (!Array.isArray(raw) || !raw.length) throw new Error(`${file}: expected a JSON array of tasks`);
      const tasks = raw.map((r, i) => ({
        id: String(r.id || `t${i + 1}`),
        title: String(r.title || r.id),
        category: (CATEGORIES as readonly string[]).includes(r.category) ? r.category : "coding",
        risk: (["low", "medium", "high"].includes(r.risk) ? r.risk : "medium") as Risk,
        brief: String(r.brief || ""),
        files: (r.files || []).map(String),
        deps: (r.deps || []).map(String),
        checks: r.checks || [],
        status: "pending" as const,
        attempts: [],
        excluded: [],
        reassigns: 0,
        ...(r.timeoutMin ? { timeoutMin: Number(r.timeoutMin) } : {}),
      }));
      const ids = new Set(tasks.map((t) => t.id));
      if (ids.size !== tasks.length) throw new Error(`${file}: task ids must be unique`);
      const bad = tasks.flatMap((t) => t.deps.filter((d: string) => !ids.has(d) || d === t.id).map((d: string) => `${t.id} -> ${d}`));
      if (bad.length) throw new Error(`${file}: deps must name other tasks in the file: ${bad.join(", ")}`);
      if (argv.includes("--check")) {
        const r = checkBatch(engine.vault.project(project), tasks);
        console.log(r.lines.join("\n"));
        console.log(r.ok ? "\nbatch ok (lines with ! are worth a look)" : "\nfix the problems above before running");
        if (!r.ok) process.exitCode = 1;
        break;
      }
      printEvents(engine);
      const request = words.join(" ") || `Preset tasks: ${tasks.map((t) => t.id).join(", ")}`;
      summary(await engine.startWith({ project: engine.vault.project(project), request, workflow: flag("--workflow") || "tasks", tasks }));
      break;
    }
    case "resume": {
      if (!args[0]) throw new Error("usage: orch resume <run> [--choice C] [--note ...]");
      printEvents(engine);
      const choice = flag("--choice");
      summary(await engine.resume(args[0], choice ? { choice, note: flag("--note") } : undefined));
      break;
    }
    case "abort": {
      if (!args[0]) throw new Error("usage: orch abort <run>");
      console.log(`${args[0]}: ${engine.abort(args[0])}`);
      break;
    }
    case "status": {
      if (args[0]) return summary(engine.vault.loadState(args[0]));
      for (const s of engine.vault.runs()) {
        const done = s.tasks.filter((t) => t.status === "accepted").length;
        console.log(`${s.status.padEnd(8)} ${s.id.padEnd(52)} ${done}/${s.tasks.length} tasks  $${s.costUsd.toFixed(3)}${s.waiting ? `  waits: ${s.waiting.kind}` : ""}`);
      }
      break;
    }
    case "summary": {
      if (!args[0]) throw new Error("usage: orch summary <run>");
      console.log(runSummary(engine, engine.vault.loadState(args[0])));
      break;
    }
    case "merge": {
      if (!args[0]) throw new Error("usage: orch merge <run> [--no-test]");
      const r = await mergeRun(engine.vault.loadState(args[0]), { test: !argv.includes("--no-test"), log: (l) => console.log(l) });
      if (!r.ok) process.exitCode = 1;
      break;
    }
    case "models": {
      const reg = await engine.models.list(argv.includes("--refresh"));
      console.log(`models (refreshed ${reg.refreshed}):`);
      for (const m of reg.models) {
        const cool = engine.models.coolingDown(m.key);
        console.log(`  ${m.tier.padEnd(9)} ${engine.models.billing(m.key).padEnd(13)} ${m.key}${m.contextLength ? `  ${Math.round(m.contextLength / 1000)}k` : ""}${cool ? `  cooling (${cool.reason}) until ${cool.until.slice(11, 16)}` : ""}`);
      }
      if (reg.skipped.length) console.log(`skipped: ${reg.skipped.join(", ")}`);
      break;
    }
    case "route": {
      const category = args[0] as Category;
      if (!CATEGORIES.includes(category)) throw new Error(`category must be one of ${CATEGORIES.join(", ")}`);
      const profile = engine.agents()[category];
      const { candidates, dropped } = await engine.router.rank({
        category,
        mode: (flag("--mode") as Mode) || profile?.mode || "edit",
        risk: (flag("--risk") as Risk) || "medium",
        minTier: (flag("--tier") as Tier) || profile?.minTier || "light",
        exclude: [],
        contextNeeded: 20_000,
        budgetUsd: engine.cfg.budget.perTaskUsd,
        escalated: argv.includes("--escalated"),
      });
      console.log("score   bench corr  tools ctx   lat   cost  model");
      for (const c of candidates.slice(0, Number(flag("--top") || 10))) {
        const p = c.parts;
        const f = (x: number) => x.toFixed(2).padEnd(5);
        console.log(`${c.score.toFixed(3)}   ${f(p.benchmark)} ${f(p.correctness)} ${f(p.tools)} ${f(p.context)} ${f(p.latency)} ${f(p.cost)} ${c.key}  (${c.why})`);
      }
      console.log(`dropped: ${Object.entries(dropped).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}`);
      break;
    }
    case "nodes": {
      const list = Object.values(NODE_TYPES).map(({ run, ...rest }) => rest);
      if (argv.includes("--json")) console.log(JSON.stringify(list, null, 2));
      else for (const n of list) console.log(`${n.type.padEnd(20)} [${n.ports.join(", ")}]  ${n.description}`);
      break;
    }
    case "workflow": {
      const wf = engine.workflow(args[0] || "default");
      if (argv.includes("--json")) return console.log(JSON.stringify(wf, null, 2));
      console.log(`${wf.name}: ${wf.description ?? ""}\nvalid: ${validate(wf).length === 0}`);
      for (const n of wf.nodes) {
        const outs = wf.edges.filter((e) => e.from === n.id).map((e) => `${e.port ?? "out"} -> ${e.to}`);
        console.log(`  ${n.id.padEnd(12)} ${n.type.padEnd(20)} ${outs.join(", ") || "(end)"}`);
      }
      break;
    }
    case "graph": {
      const p = engine.vault.project(args[0] || hostProject(engine));
      console.log(`building the code map of ${p.repo} with Graphify (AST only, no tokens) ...`);
      const g = await buildCodeGraph(p, engine.vault.p("Code", p.name), engine.cfg.graphify.command);
      console.log(`${g.summary}; ${g.notes} Obsidian notes in vault/Code/${p.name}/notes (commit ${g.head}). The senior reads GRAPH_REPORT.md when planning.`);
      break;
    }
    case "bench": {
      if (argv.includes("--selftest")) {
        const r = await selftest();
        for (const x of r) console.log(`${x.ok ? "OK  " : "FAIL"} ${x.id.padEnd(18)} ${x.note}`);
        if (r.some((x) => !x.ok)) process.exitCode = 1;
        break;
      }
      const list = (f: string) => flag(f)?.split(",").map((s) => s.trim()).filter(Boolean);
      // only the check-ins: node logs of parallel jobs would drown the bench output
      engine.on("event", (e) => {
        if (e.type === "watch")
          console.log(`${new Date().toTimeString().slice(0, 8)}  check-in ${e.agent} (${e.model}): ${e.minutes} min, ${e.newLines} new lines, ${e.repeated} repeated -> ${e.verdict}`);
      });
      const rows = await runBenchmarks(
        engine,
        {
          random: Number(flag("--random") || 3),
          tasks: list("--tasks"),
          perTask: Number(flag("--per-task") || 2),
          models: list("--models"),
          adapters: list("--adapters"),
          parallel: Number(flag("--parallel") || 3),
          seed: Number(flag("--seed") || Date.now() % 100000),
          premium: argv.includes("--premium"),
          timeoutMin: Number(flag("--timeout") || 12),
        },
        (line) => console.log(`${new Date().toTimeString().slice(0, 8)}  ${line}`),
      );
      console.log(`
${rows.filter((r) => r.pass).length}/${rows.length} passed`);
      for (const r of rows) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.b.id.padEnd(16)} ${r.model.padEnd(55)} ${String(r.sec).padStart(4)}s  ${r.pass ? "" : r.reason}`);
      console.log(`
results: vault/Benchmarks/ and vault/Executions/ (source: benchmark)`);
      break;
    }
    case "import-scorecard": {
      const data = readJson<{ attempts: any[] }>(path.resolve(args[0] || ""), { attempts: [] });
      let n = 0;
      for (const a of data.attempts) {
        if (/probe/.test(a.run)) continue; // test entries, not real work
        const map: Record<string, Category> = { "ui-polish": "coding", "client-feature": "coding", "backend-fix": "debugging", "browser-test": "testing", investigate: "research" };
        engine.vault.recordExecution({
          run: `import-${a.run}`, task: a.task_type, attempt: a.attempt, model: `${a.tool}:${a.model}`, adapter: a.tool,
          category: map[a.task_type] ?? "coding", risk: "medium", source: "import", success: a.score >= 90, checksPassed: a.score >= 60,
          latencySec: 0, costUsd: 0, tokensIn: 0, tokensOut: 0, retryIndex: a.attempt - 1, reviewScore: a.score, toolFailure: "",
          decision: a.verdict, date: a.t ? `${a.t}T00:00:00.000Z` : now(),
        });
        n++;
      }
      for (const key of new Set(data.attempts.map((a) => `${a.tool}:${a.model}`))) engine.vault.writeModelNote(key);
      console.log(`imported ${n} execution record(s)`);
      break;
    }
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error(`orch: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
