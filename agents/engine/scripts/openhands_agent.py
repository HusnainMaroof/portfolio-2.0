"""Run one orchestrator task on the OpenHands agent runtime, driving an agent CLI over ACP.

OpenHands (SDK, LocalWorkspace, no Docker) owns the conversation, event stream,
stuck detection and usage metrics; the backend agent is any ACP server, e.g.
`opencode acp`, `kilo acp`, `cline --acp`. The backend uses its own login and
model, so no API key is needed here.

usage:
  python -I openhands_agent.py --acp "opencode acp" --model <backend model id>
      --session-mode <mode id> --cwd <dir> --prompt-file <file> [--timeout-sec N]

Progress goes to stdout one line per event (the engine's stall detection watches it).
The last line is a JSON object in Claude Code's `--output-format json` shape
({"result", "is_error", "total_cost_usd", "usage"}), so the adapter can read it.
"""
import argparse
import json
import shlex
import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def short(text, n=160):
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def on_event(e):
    name = type(e).__name__
    if name == "ACPToolCallEvent":
        print(f"[tool] {short(getattr(e, 'title', '') or getattr(e, 'kind', ''))}", flush=True)
    elif name in ("AgentErrorEvent", "ConversationErrorEvent"):
        print(f"[error] {short(getattr(e, 'error', None) or getattr(e, 'detail', ''), 2000)}", flush=True)
    else:
        print(f"[{name}]", flush=True)


def strict_model(acp_mod):
    """OpenHands falls back to the server's default model when the requested one is
    rejected. The router must know which model did the work, so a rejection fails the run."""
    orig = acp_mod._maybe_set_session_model

    async def strict(conn, agent_name, session_id, acp_model, **kw):
        ok = await orig(conn, agent_name, session_id, acp_model, **kw)
        if acp_model and not ok:
            raise RuntimeError(f"model not found: {acp_model} was rejected by {agent_name}")
        return ok

    acp_mod._maybe_set_session_model = strict


def run(a):
    import openhands.sdk.agent.acp_agent as acp_mod
    from openhands.sdk import Conversation
    from openhands.sdk.conversation.response_utils import get_agent_final_response

    strict_model(acp_mod)
    cmd = shlex.split(a.acp)
    exe = shutil.which(cmd[0])  # npm shims on Windows are .CMD files
    if not exe:
        raise RuntimeError(f"crash: ACP command not found: {cmd[0]}")
    agent = acp_mod.ACPAgent(
        acp_command=[exe, *cmd[1:]],
        acp_model=a.model,
        acp_session_mode=a.session_mode,
        acp_prompt_timeout=a.idle_sec,  # idle deadline, reset on every update
        acp_startup_timeout=120,
    )
    prompt = Path(a.prompt_file).read_text(encoding="utf-8")
    if a.warmup_sec:
        # some backends (Kilo) never answer the first turn of a new session; a throwaway
        # turn with a short deadline gets past it, then the real deadline is restored
        object.__setattr__(agent, "acp_prompt_timeout", a.warmup_sec)
    conv = Conversation(agent=agent, workspace=str(Path(a.cwd).resolve()), callbacks=[on_event], visualizer=None)
    try:
        if a.warmup_sec:
            conv.send_message("Reply with the single word OK. Do not use any tools.")
            conv.run()
            object.__setattr__(agent, "acp_prompt_timeout", a.idle_sec)
            print("[warmup] done", flush=True)
        conv.send_message(prompt)
        conv.run()
        text = get_agent_final_response(conv.state.events)
    finally:
        m = conv.conversation_stats.get_combined_metrics()
        u = m.accumulated_token_usage
        usage = {
            "input_tokens": max(0, (u.prompt_tokens if u else 0) - (u.cache_read_tokens if u else 0)),
            "cache_read_input_tokens": u.cache_read_tokens if u else 0,
            "output_tokens": u.completion_tokens if u else 0,
        }
        cost = m.accumulated_cost or 0
        conv.close()
    if text.strip() == "(No response from ACP server)":
        # some backends (cline) swallow the provider error, e.g. a retired model's 404; say so plainly
        # so the engine classifies it as the provider's fault, not as a crash of the model
        print("error: no response from ACP server (the backend may not serve this model)", flush=True)
        text = ""
    return text, cost, usage


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--acp", required=True, help='ACP server command, e.g. "opencode acp"')
    p.add_argument("--model", required=True)
    p.add_argument("--session-mode", default=None)
    p.add_argument("--cwd", required=True)
    p.add_argument("--prompt-file", required=True)
    p.add_argument("--idle-sec", type=float, default=600)
    p.add_argument("--warmup-sec", type=float, default=0, help="send a throwaway first turn with this idle deadline")
    p.add_argument("--title", default="")  # unused; makes the process findable by the engine's kill markers
    a = p.parse_args()
    # Windows asyncio pipes print "Exception ignored ... closed pipe" from __del__ at teardown, after the
    # result is out; that noise filled every agent log. Real errors still go through the except below.
    sys.unraisablehook = lambda _u: None
    try:
        text, cost, usage = run(a)
        print(json.dumps({"result": text, "is_error": not text.strip(), "total_cost_usd": cost, "usage": usage}), flush=True)
    except Exception as e:  # error text goes to stdout so the engine can classify it (rate limit, auth, not found)
        print(f"error: {type(e).__name__}: {e}", flush=True)
        print(json.dumps({"result": f"error: {e}", "is_error": True, "total_cost_usd": 0, "usage": {}}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
