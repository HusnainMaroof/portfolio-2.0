---
name: smurf-ship
description: Ship a piece of work end to end through the orchestrator with free agents - write the task batch, check it, run it, summarize, review, merge, commit. Use when the owner asks for a feature or fix to be done by the agents (not by you directly).
---

# Ship work through the agents

One routine instead of re-deriving the workflow each time. You are the senior: you write precise
tasks and judge the result; free agents write the code. Commands run from the repo root; prefix
runs with `ORCH_CONFIG=agents/config/free-only.json` (free models only).

## 1. Batch

Read the code the work touches first (exact file names, function names, data shapes). Then write
`agents/tasks/<name>.json` from `batch-template.json` in this folder. Rules that decide
whether free agents succeed:

- One task = one bounded change. Split by file so tasks run in parallel; give tasks that share a
  file a `deps` order.
- `files`: every file the agent may change or create, including its test file.
- `checks`: the project's build and test commands (exit 0 = pass). Use commands on the project's
  allow-list (`agents/vault/Projects/<project>.md`, `allowedCommands`) or the run stops for approval.
- `brief`: stack and folder; files to read first; exact names, signatures and shapes copied from
  the code; numbered steps; what done looks like; what not to touch. 400-1500 characters is normal.
- `risk`: high only for auth, money, data deletion, migrations, dependencies (the senior must then
  confirm the accept).

## 2. Check, then run

```bash
./agents/orch run-tasks <project> agents/tasks/<name>.json --check     # fix every "!" line that matters
ORCH_CONFIG=agents/config/free-only.json ./agents/orch run-tasks <project> agents/tasks/<name>.json "<title>"
```

Start the run in the background and wait for the completion notice; do not poll. Commit the batch
file (`git add agents/tasks/<name>.json`) so the work is traceable.

## 3. When it stops

```bash
./agents/orch summary <run>
```

- WAITING: read the question. Answer with `./agents/orch resume <run> --choice <option> [--note "..."]`
  (in the background again). For an escalation, read `agents/vault/Runs/<run>/<task>.md` first.
- DONE: go to step 4. FAILED: read the error line and `events.jsonl`; if it is an engine bug, use
  the `smurf-fix` skill, fix it, then `resume`.

## 4. Review

Read the diff, not just the scores: `git -C <repo> diff <base>...orch/<run>`. Check that each task
did what its brief said and nothing more, and that the follow-ups in the summary do not hide a real
problem. If something is wrong, write a small follow-up batch instead of fixing it by hand.

## 5. Merge and commit

```bash
./agents/orch merge <run>     # merges, runs every accepted task's checks on the merged code, commits only if all pass
```

It refuses a dirty tree or the wrong branch, and undoes the merge when a check fails. Never push
unless the owner says so. Tell the owner: what was done, by which models, checks and review, the
merge commit, and the follow-ups worth a next batch.
