---
name: smurf-go
description: One command for the whole orchestrator workflow - the owner says what they want ("/smurf-go add dark mode to settings") and this launches it end to end on free models - senior plans, agents work in parallel, engine verifies and reviews, you supervise, then summary, merge and report. Use when the owner asks to "launch", "run the workflow", "let the agents do it" or types /smurf-go.
---

# Launch the whole workflow

The owner gives one request; you drive it to a merged result. Free models only, from the repo
root. Do not write the code yourself: the agents do, the engine judges from evidence, you supervise.

## 1. Launch

If the request is vague, ask one short question first; otherwise go.

```bash
ORCH_CONFIG=agents/config/free-only.json ./agents/orch run [project] "<request>"
```

No project = this repo. The `default` workflow runs: code map -> senior understands and plans ->
approval (risky plans only) -> parallel task lanes (route -> delegate -> verify -> review ->
decide) -> report. Start it in the background and wait for the completion notice; tell the owner
the run id and the plan (`./agents/orch status <run>`).

If the owner already has exact tasks, use the `smurf-ship` skill instead (preset batch, no senior).

## 2. Supervise while it runs

Every ~10 minutes (the `smurf-agents` skill has the routine): `./agents/orch summary <run>`,
the latest `"watch"` events in `agents/vault/Runs/<run>/events.jsonl`, the agent's log tail.
Stop a looping or silent agent (`./agents/orch abort <run>` as a last resort), do not wait it out.
Give the owner a short status every ~15 minutes: done, running, next.

## 3. When it stops

`./agents/orch summary <run>`, then:

- **Plan approval**: check the plan is small tasks with the right files and checks; approve with
  `./agents/orch resume <run> --choice approve`, or reject with a `--note` saying what to change.
- **Escalation**: read `agents/vault/Runs/<run>/<task>.md`; pick accept / retry / reassign / skip /
  abort with `resume`. Ask the owner only for real product decisions or high-risk accepts.
- **Senior question**: answer it from the code if you can (`--choice answer --note "..."`).
- **Failed**: an engine bug -> `smurf-fix` skill, then `resume`.

Resume runs in the background too; repeat until DONE.

## 4. Review, merge, report

1. Read the diff: `git diff <base>...orch/<run>`. Each task did its brief and nothing more?
   Problems -> a small follow-up run, not a hand fix.
2. `./agents/orch merge <run>`: re-runs every accepted task's checks on the merged code and makes
   one commit (the owner's rule: one commit per finished major task). Never push unless told.
3. Final report (AGENTS.md format): numbered list of how each task was done (steps, model, checks,
   decisions), then a table task | model | result | checks | cost, then follow-ups and questions.
