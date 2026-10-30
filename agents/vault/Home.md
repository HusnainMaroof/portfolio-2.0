# Orchestrator vault

Everything the AI team knows lives here, linked together.

| Folder | What | Written by |
|---|---|---|
| [[Agents/coding\|Agents]] | One profile per role (category, mode, minimum tier, review policy, role prompt). Edit these to change how agents behave. | You |
| Projects | One note per registered repo: path, base branch, allowed check commands, notes for the senior model. | `orch init`, then you |
| Runs | One folder per run: `index` (understanding, task table), one note per task (brief, attempts, evidence, review, decision), `report`, logs, prompts, diffs. | Engine |
| Executions | One record per agent attempt: model, category, success, checks, latency, cost, tokens, retries, review score, tool failures. The router learns from these; delete one to make the router forget it. | Engine |
| Models | One note per model: per-category results and cooldown history. | Engine |
| Code | Graphify code maps per project (`orch graph <project>`). | Graphify |

Secrets never go in this vault.
