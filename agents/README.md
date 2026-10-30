# Agents orchestrator

A senior model manages a team of AI agents from many providers. It understands
the request, plans small tasks, routes each task to the best model for that kind
of work, delegates it in an isolated git worktree, verifies the result with real
evidence (tests, metrics, scope), gets an independent review, and then accepts,
retries, reassigns or escalates to you. Everything is recorded in an Obsidian
vault, and the router learns from it.

The workflow is a graph of nodes (`agents/engine/workflows/default.json`), n8n style: edit the
JSON to change the flow (`./agents/orch nodes` lists the node types). The CLI drives the engine.

## Quick start

`agents/` is a drop-in folder: copy it into any git project (or clone a repo that has it) and it
works on that project. Nothing to `npm install`: Node 23.6+ runs the TypeScript directly.

```bash
./agents/orch setup                     # local config, Claude Code skills into .claude/skills, which agent CLIs you have
./agents/orch setup --openhands         # optional: OpenHands runtime (Python venv in ~/.orch)

export ORCH_CONFIG=agents/config/free-only.json   # free models only
./agents/orch run "the sales API takes 2 seconds, make it fast"   # works on the project agents/ is in
./agents/orch summary <run>             # one screen: tasks, evidence, question, diff, follow-ups
./agents/orch resume <run> --choice approve
./agents/orch merge <run>               # re-runs every check on the merged code, commits if all pass
```

On Windows cmd or PowerShell use `agents\orch` (runs `orch.cmd`); Git Bash uses `./agents/orch`.
The first run registers the project in `agents/vault/Projects/<name>.md` (allowed check commands:
`npm test`, `npm run`, `npx tsc`; widen them there). Another repo: `./agents/orch init <repo> --name n`,
then `./agents/orch run n "<request>"`.

Working on the orchestrator itself (`cd agents/engine`): `npm install` (typescript only, for the
type-check), `npx tsc --noEmit`, `npm test` (all tests with the mock provider, no tokens).

## The loop

```text
codemap -> understand -> plan -> owner approval (risky only) -> for each task (parallel lanes):
  prepare worktree + baseline -> route -> delegate -> verify evidence -> review -> decide
     accept   -> integrate into orch/<run>        retry    -> same model, with the exact fixes
     reassign -> next model (tier goes up)        escalate -> waits for you
-> report (you merge orch/<run> with `orch merge`)
```

| Rule | How it is enforced |
|---|---|
| Senior manages, agents work | Senior nodes only understand, plan and confirm high-risk accepts. |
| Never trust "it worked" | `verify.evidence`: the engine runs the checks itself and measures metrics before and after. Checks are not run (and nothing counts as passed) when nothing in scope changed. |
| No shared files between agents | One branch and worktree per task; stray edits outside the allowed files are undone; merged only after acceptance. |
| Independent review | Coding, testing and debugging work is always reviewed by a second model, routed separately; it is never the author. |
| Nobody loops unnoticed | Every 10 minutes (`limits.watchMin`) the engine checks each streaming agent: output that only repeats itself, or only heartbeats, stops the agent and the task is retried or reassigned. |
| Risky things need you | High risk, check commands outside the allow-list, agent `BLOCKED:` lines, failed merges. |
| Budget | Per-run and per-task USD limits; metered models over budget are filtered out. |

Owner commands: `status`, `summary <run>`, `resume <run> --choice <option>` (a senior question with
options takes `--choice 1|2|...`), `abort <run>`, `merge <run>`, `run-tasks <project> <file> --check`.

## Context for the agents

| Who | Gets |
|---|---|
| Senior (understand, plan) | Repo snapshot, Graphify `GRAPH_REPORT.md`, project notes (`agents/vault/Projects/<name>.md`), and **lessons** from the project's recent runs: failed and retried tasks with their critiques, open follow-ups of the newest run |
| Worker | Its brief, allowed files, checks, the run's other tasks (so it neither does nor reports them), reports of the tasks it depends on, and **RELATED FILES** from the code map: what its files import and what uses them |

## Routing

The router filters (mode, tier, cooldown, context, budget), then ranks by
`agents/config/orchestrator.json` weights: own benchmarks 30, correctness 25, tool
compatibility 15, context 10, latency 10, cost 10. Each signal is learned from
`agents/vault/Executions` and shrunk toward a prior, so untested models still get a chance.
`orch route <category>` shows the breakdown.

Failures cool a model down by class (`router.cooldownMin`). Provider problems (`rate_limit`,
`auth`, `not_found` incl. retired models, `no_response` from an ACP backend that hides the error)
never count against a model's quality; crashes, timeouts and bad output do.

## Benchmarks (the router's 30%)

`agents/engine/benchmarks/<id>/` holds small, self-contained tasks: a fixture repo, checks, and
a reference solution. Coding, debugging, testing (tests must kill mutants),
performance (metric must drop), research and review (report must contain the
real finding), and docs.

```bash
./agents/orch bench --selftest                 # each fixture fails, each solution passes
./agents/orch bench --random 3 --per-task 2    # random tasks x least-tested free models
./agents/orch bench --tasks fast-fib --models opencode:opencode/deepseek-v4.1-flash-free
```

Each job gets its own temp repo and worktree, one attempt, a time limit, and a
pass/fail from engine evidence only. Results go to `agents/vault/Executions` (source:
benchmark) and a summary note in `agents/vault/Benchmarks/`. Jobs run in parallel, but
only one at a time per provider, because free tiers share quotas. Add a task:
edit `agents/engine/scripts/make_benchmarks.py`, run it, then run `bench --selftest`.

## Providers

| Adapter | Covers | Notes |
|---|---|---|
| `cli` | Claude Code, Cline, OpenCode, Kilo, Codex, any other agent CLI | Command templates in config (`{model}`, `{promptFile}`, `{cwd}`, `{root}`, `{timeoutSec}`, ...); the prompt goes on stdin. Agents run with git disabled. Parse modes: `text`, `claude-json`, `commandcode-json`, `out-file`. |
| `api` | OpenRouter, OpenAI, Ollama, LM Studio, any OpenAI-compatible API | Model discovery reads context length and price. API models edit through a file-block protocol limited to allowed files. Keys come from env vars. |
| `openhands` | OpenCode, Kilo, Cline driven over ACP | OpenHands SDK is the agent runtime (conversation, events, stuck detection, usage), `LocalWorkspace`, no Docker. The CLI is the backend, with its own login and models, so no API key. Keys look like `openhands:opencode/opencode/glm-5.3-flash-free`. A model the backend rejects fails the run (`not_found`) instead of silently using the backend's default. |
| `mock` | Tests and UI development | Scripted, no tokens. |

OpenHands setup: a Python 3.12 venv at `~/.orch/openhands-venv` with `openhands-sdk`
and `openhands-tools` (`./agents/orch setup --openhands`, runner `agents/engine/scripts/openhands_agent.py`).
Add a backend under `providers.openhands.backends`: its ACP command, optional env prefix, and the
ACP session mode for `readonly` and `edit`.

Adding a provider: put a `cli` entry in `agents/config/orchestrator.json` with its run commands
and models (`enabled: false` until a short `bench --models <key>` run passes). A tool without a
headless mode can be wrapped in a small driver script that the run command calls; the provider's
`_note` in the config says how each one is set up and what it costs.

## Token saving (Caveman style)

`"terse": "off" | "lite" | "full" | "ultra"` makes agent-to-agent text (reports,
review findings, JSON fields) short, after the
[Caveman skill](https://github.com/JuliusBrussee/caveman). Code, commands, paths
and errors stay exact. Text you read (reports, questions) is never compressed.

## Code map (Graphify)

The first node of every run (`context.codemap`, in both the `default` and `tasks` workflows)
refreshes the project's [Graphify](https://github.com/Graphify-Labs/graphify) code map when the
repo has new commits: `graphify update` (AST only, no tokens), then one Obsidian note per
function/class/module in `agents/vault/Code/<project>/notes`, plus `GRAPH_REPORT.md` for the senior and
`graph.json` for the workers' RELATED FILES. `orch graph <project>` does the same by hand.
Install: `pip install graphifyy`.

## Claude Code skills

For a Claude Code session acting as the supervisor. They live in `agents/skills/` and
`./agents/orch setup` copies them to the project's `.claude/skills/`, where Claude Code finds them.

| Skill | For |
|---|---|
| `smurf` | Operating and changing the orchestrator |
| `smurf-go` | One request, whole workflow: senior plans, agents run, supervise, merge, report (`/smurf-go <request>`) |
| `smurf-ship` | Ship work through the agents: batch, check, run, review, merge |
| `smurf-fix` | Turn a real run problem into an engine fix with a test |
| `smurf-agents` | Which agent for which need, how to launch each one, the 10-minute check on running agents |

## Layout

```text
your-project/
├── agents/                  the orchestrator, drop-in
│   ├── orch, orch.cmd       the one command (bash / cmd, PowerShell)
│   ├── README.md            this file
│   ├── engine/              the engine: all code and its tooling
│   │   ├── src/             engine, nodes, router, models, adapters, workspace, ship, graph, lessons, vault, prompts
│   │   ├── workflows/       workflow graphs (also loaded from vault/Workflows)
│   │   ├── scripts/         setup, provider runners and drivers, benchmark and Graphify helpers
│   │   ├── benchmarks/      the router's benchmark tasks
│   │   ├── tests/           mock-provider tests (cd agents/engine && npm test)
│   │   └── package.json     dev only (typescript for the type-check)
│   ├── skills/              what the supervisor (Claude Code) knows how to do; installed by orch setup
│   ├── config/              providers, models, rules, limits; local.json is yours (git-ignored)
│   ├── tasks/               task batches for run-tasks
│   └── vault/               memory (Obsidian): role profiles, benchmarks; runs, models, code map git-ignored
└── .claude/skills/          generated by orch setup
```
