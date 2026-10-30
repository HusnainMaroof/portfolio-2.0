---
name: smurf
description: Operate and improve the AI dev-team orchestrator in the agents/ folder. Use when running work through it (orch run / run-tasks / resume), writing task batches for the free agents, watching or debugging a run, reviewing and merging a run's integration branch, or changing the engine itself.
---

# Orchestrator playbook

The orchestrator in `agents/` (command `./agents/orch`) is how work gets done here: you act as the senior, write
precise tasks, and free agents do them. Read `AGENTS.md` at the repo root for the code layout and
conventions before changing the engine.

Focused skills cover the repeated routines: `smurf-go` (one request -> whole default workflow -> merge),
`smurf-ship` (batch -> check -> run -> summary ->
review -> merge) and `smurf-fix` (real run problem -> engine fix + test). Use them instead of
re-deriving the steps.

All commands run from the repo root. Prefix with `ORCH_CONFIG=agents/config/free-only.json` to use
free models only (the owner's default; no paid Claude/Codex/OpenAI usage).

## 1. Choose how to run work

| Situation | Command |
|---|---|
| A plain request; let the senior model plan | `./agents/orch run <project> "<request>"` |
| You already know the tasks (best quality) | `./agents/orch run-tasks <project> agents/tasks/<batch>.json "<title>"` |
| The run waits for the owner | `./agents/orch resume <run> --choice <option> [--note "..."]` |
| What is running / waiting | `./agents/orch status [run]` |
| One-screen view of a run (tasks, evidence, question, diff stat, follow-ups, next step) | `./agents/orch summary <run>` |
| Check a batch before running it | `./agents/orch run-tasks <project> <file> --check` |
| Merge a finished run (checks re-run on the merged code; commits only if all pass) | `./agents/orch merge <run>` |
| Register a repo | `./agents/orch init <repo> --name <n> --allow "npm test,npx tsc" --link node_modules` |

Runs take minutes: start them in the background and wait for the completion notice; do not poll.

## 2. Write a task batch that free agents finish

A batch is a JSON array: `{ id, title, category, risk, timeoutMin, files, deps?, checks, brief }`.
Categories: coding, debugging, testing, research, review, architecture, docs. Risk high means the
senior must confirm the accept.

- **files**: the exact files the agent may change, including new files and their tests. Anything
  else it touches is undone by the engine. Two tasks that share a file must be ordered with `deps`.
  Tasks without shared files or deps run in parallel (up to 3).
- **checks**: commands the engine runs in the task's worktree; exit 0 = pass. Usually build and
  tests. Commands outside the project's allow-list need the owner's approval first.
- **brief**: the biggest lever on quality. Include: the stack and folder; which files to read
  first; the exact names, signatures and data shapes (read them from the code yourself, do not
  guess); numbered steps; what done looks like; what not to touch ("only change X").
  Free models follow exact instructions well and invent badly when the brief is vague.
- One task = one bounded change, roughly what one engineer would do in an hour.
- `run-tasks` rejects duplicate ids and deps that name unknown tasks.

## 3. Watch and debug a run

Run folder: `agents/vault/Runs/<run>/`.

| File | Use |
|---|---|
| `events.jsonl` | Every node start/end and log line. `grep -o '"msg":"[^"]*' events.jsonl` is the quick timeline |
| `index.md`, `<task>.md` | Task table; per task: attempts, decisions, checks, review findings |
| `logs/<task>-a<n>.log` / `.prompt.txt` | The agent's full output and the exact prompt it got |
| `<task>-a<n>.diff`, `<task>-a<n>-report.md` | What the agent changed and what it claims |
| `report.md` | Final report, including Follow-ups (agent notes, reverted files, review findings) |

Common causes:
- `failure rate_limit` on a free model: it cools down (see `./agents/orch models`); the router
  moves on. Not a bug.
- Escalation "agent escalated: BLOCKED: ...": read the line. If it is a real decision, answer it
  (`--choice retry --note "..."` or `accept`/`skip`).
- "senior model unavailable": every senior in the chain failed; see `logs/senior-*.log`.
- A fix in the engine applies to the next process: resume the run after changing code.

## 4. Review and merge a run

Accepted work is on branch `orch/<run>`; nothing touches `main` until you merge.

1. `git diff --stat main...orch/<run>` then read the diff of each file. Check the agent did what
   the brief asked and nothing more; the review score is a hint, not proof.
2. `./agents/orch merge <run>`: merges without committing, re-runs every accepted task's checks
   on the merged code, and commits only if all pass (otherwise the merge is undone). It refuses a
   dirty tree or the wrong branch.
3. If the run's branch is older than other merges, also check files outside the batch did not
   change: `git diff HEAD^1 HEAD --stat -- <paths the batch should not touch>`.
4. Turn the report's Follow-ups into the next batch, or note them for the owner.
5. Commit after big changes; never push unless the owner says so.

## 5. Change the engine

Follow `AGENTS.md`. Every behaviour change gets a mock-provider test (pattern: `agents/engine/tests/guards.ts`),
then `npx tsc --noEmit` and `npm test` must pass. When a real run shows a bug, fix the engine and
add the case to a test so it stays fixed.
