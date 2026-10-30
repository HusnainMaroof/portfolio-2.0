---
name: smurf-fix
description: Turn something that went wrong in a real orchestrator run (wrong escalation, crash, wasted retry, bad routing, stuck run) into an engine fix with a regression test. Use when a run's summary, events or logs show the orchestrator itself misbehaved, not the agent's code.
---

# Fix the orchestrator from a real run

The best bugs come from real runs. Work from evidence, fix the engine, and lock it with a test.

## 1. Find what really happened

In `agents/vault/Runs/<run>/`:

```bash
grep -o '"msg":"[^"]*' events.jsonl | cut -c8-300          # the timeline
```

Then the task note `<task>.md` (decisions and reasons), `logs/<task>-a<n>.log` and `.prompt.txt`
(what the agent saw and did), `<task>-a<n>-report.md` and `.diff`. Decide which of these it is:

| Symptom | Usually |
|---|---|
| Task escalated though the work is fine | `blockedLines` / `stillBlocked` in `agents/engine/src/nodes/agent.ts` |
| Retry or reassign that wasted good work | `verify.evidence` (scope, checks) or `senior.decide` in `agents/engine/src/nodes/senior.ts` |
| Same bad answer from every model | the prompt in `agents/engine/src/prompts.ts` or a role in `agents/vault/Agents/*.md` |
| "failure crash/bad_output" with a real answer | answer extraction in `agents/engine/src/adapters/cli.ts`, failure classes in `agents/engine/src/adapters/common.ts` |
| Wrong model picked | `agents/engine/src/router.ts` (`./agents/orch route <category> --risk <r>` shows the ranking) |
| Run stuck, wrong order, lanes | `lanes` / `lane` in `agents/engine/src/engine.ts`, `pickReady` in `agents/engine/src/nodes/flow.ts` |
| Misleading question to the owner | `human.escalation` / `human.approval` in `agents/engine/src/nodes/flow.ts` |

Not a bug: rate limits and cooldowns on free models, or an agent that simply wrote bad code (that
is what retry, reassign and review are for).

## 2. Reproduce it with the mock provider

Add the case to a test (pattern: `agents/engine/tests/guards.ts`). The mock script can make an agent edit files
(`edits`), write stray files (`stray`) and add text to its report (`say`). Watch the test fail
before you fix it.

## 3. Fix and verify

Smallest change in the engine that handles the case; keep agents' real blockers and failures
working. Then:

```bash
cd agents/engine && npx tsc --noEmit && npm test
```

## 4. Apply to the live run and commit

Engine changes apply to the next process: `./agents/orch resume <run> ...` continues the run with
the fix. Commit the fix and its test together, message naming the run symptom. Never push unless
the owner says so.
