---
name: smurf-agents
description: Launch the right agent tool (Claude Code, OpenCode, Kilo, Cline, OpenHands, Freebuff, Command Code, Codex) for a piece of work, as the supervisor, and check on every running agent every 10 minutes so none loops or hangs unnoticed. Use when choosing which agent should do a task, starting agents through the orchestrator or directly, or supervising agents that are running.
---

# Launch and supervise agents

You are the supervisor. Agents do the work; you pick the tool for the need, start it, check on it
every 10 minutes, and judge the result from evidence (diff, checks), never from its claims.
Commands run from the repo root; add `ORCH_CONFIG=agents/config/free-only.json` (free models only, the
owner's default).

## 1. Pick the agent for the need

| Need | First choice | Why | Also good |
|---|---|---|---|
| Code change with tests (coding, debugging, testing) | `openhands:opencode/opencode/deepseek-v4.1-flash-free` | Router's #1 for coding/testing/debugging; OpenHands adds stuck detection | `kilo:kilo/reflection/beam-free` (fast), `cline:poolside/laguna-s-2.1:free` |
| Read-only research / explain code | `openhands:opencode/opencode/deepseek-v4.1-flash-free` | Accurate file:line citations | `cline:nvidia/nemotron-3-ultra-550b-a55b:free` (~30 s) |
| Independent review of a diff | `openhands:cline/poolside/laguna-s-2.1:free` | Most reviews, scores track real problems | `cline:nvidia/nemotron-3-ultra...` |
| A model only Freebuff has (GPT-6 Luna, Muse Spark, Glyph Cluster) or free unlimited extra capacity | `freebuff:Nemotron 3.5 Lightning`, `freebuff:Glyph Cluster` (UNLIMITED: no hours) | TUI driver; one session at a time | `freebuff:GLM 5.3 Flash`, `freebuff:GPT-6 Luna` (use daily hours) |
| Hard task after free models failed | `claude:sonnet` / `claude:opus` (subscription) | Premium; only with the owner's yes | `codex` (disabled until a model is set) |
| Planning a run (senior) | the senior chain in `agents/config/` | The engine calls it | — |

Live ranking per category: `./agents/orch route <category>`. Disabled now: Command Code (no
credits), Codex (no model set). Retired today: any `minimax-m3.1-flash:free` and nemotron-3-super.

## 2. Launch

Through the orchestrator (default: worktree, scope, checks, review, routing all handled):

```bash
./agents/orch run-tasks <project> agents/tasks/<batch>.json "<title>"     # preset tasks; see the smurf-ship skill
./agents/orch run <project> "<request>"                             # the senior plans
./agents/orch bench --tasks <bench-task> --models "<key>,<key>"     # try one model on a known task
```

Start runs in the background and wait for the completion notice. One task on one specific model:
`bench --models` (benchmark tasks) is the only way to force a model; real tasks are routed.

Directly (quick one-off outside a run; you check the result yourself):

| Tool | Command (prompt in a file, run in the target folder) |
|---|---|
| OpenCode | `XDG_DATA_HOME="$HOME/.opencode-free" opencode run --standalone --agent build --auto -m opencode/deepseek-v4.1-flash-free --title t "Follow the instructions given on stdin." < prompt.txt` (`--agent plan` = read-only) |
| Kilo | `kilo run --auto --agent code -m kilo/reflection/beam-free --title t "Follow the instructions given on stdin." < prompt.txt` |
| Cline | `cline -t 900 -m poolside/laguna-s-2.1:free --json "Follow the instructions given on stdin." < prompt.txt` |
| OpenHands | `"$HOME/.orch/openhands-venv/Scripts/python.exe" -I agents/engine/scripts/openhands_agent.py --acp "opencode acp" --model opencode/deepseek-v4.1-flash-free --session-mode build --cwd . --prompt-file prompt.txt` |
| Freebuff | `node agents/engine/scripts/freebuff_drive.cjs run --cwd . --prompt-file prompt.txt --max-min 20 --model "Nemotron 3.5 Lightning"` (`models` lists the picker, `pick --model X` tests a pick, `probe` shows the screen) |
| Claude Code | `claude -p --model sonnet --output-format json < prompt.txt` (subscription: ask first) |

Freebuff rules: the driver never confirms paid hours (`FREEBUFF_ALLOW_PAID=1` only with the owner's
yes) and stops a session after `FREEBUFF_MAX_HOURS` (default 1) of the daily counter. If the
picker or screens change, `probe` / `pick` first. Its prompts may be used for training.

## 3. Check on every running agent every 10 minutes

The engine does this itself (`limits.watchMin`, default 10): each window it compares the agent's
new output with what it printed before. Looping (most lines repeat) or no progress (only
heartbeats) stops the agent as `stalled`, and the task is retried or reassigned. Each check-in is
an event: `check-in <agent> (<model>): N min, X new lines, Y repeated -> ok|looping|no progress`
in the run output and `agents/vault/Runs/<run>/events.jsonl` (`type: "watch"`).

Your part as supervisor, every ~10 minutes while anything runs:

1. `./agents/orch summary <run>`: which tasks are working, on which attempt and model.
2. Latest check-ins: `grep '"watch"' agents/vault/Runs/<run>/events.jsonl | tail -5`.
3. Look at the agent's own log tail: `tail -20 agents/vault/Runs/<run>/logs/<task>-a<n>.log`. Repeating
   lines, the same question restated, or only heartbeats = stuck, even before the watch fires.
4. Stuck and the watch has not caught it: `./agents/orch abort <run>` (or kill that agent's
   process), then resume or rerun; note it in `TODO.md` and fix the cause (`smurf-fix` skill).
5. Tell the owner the state (done, running, next) as a short list.

For agents you launched directly there is no engine watch: do steps 3-4 yourself, and use the
Bash tool's background mode plus a 10-minute check instead of waiting blind.
