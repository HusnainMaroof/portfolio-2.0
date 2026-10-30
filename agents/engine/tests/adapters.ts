// Command Code's --output-format json: NDJSON, the last result line carries text, tokens and the real error.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CliAdapter, parseCommandCode } from "../src/adapters/cli.ts";
import { OpenHandsAdapter } from "../src/adapters/openhands.ts";
import type { ProviderConfig } from "../src/config.ts";

const ok = parseCommandCode(
  [
    '{"type":"system","subtype":"init","model":"deepseek/deepseek-v4-flash"}',
    '{"type":"result","subtype":"success","finalText":"done","usage":{"inputTokens":10,"outputTokens":5,"cacheReadTokens":3,"cacheWriteTokens":0}}',
  ].join("\n"),
);
assert.deepEqual(ok, { text: "done", isError: false, error: "", tokensIn: 10, tokensCached: 3, tokensOut: 5 });

const bad = parseCommandCode(
  [
    '{"type":"system","subtype":"init"}',
    '{"type":"result","subtype":"error","usage":{"inputTokens":0,"outputTokens":0,"cacheReadTokens":0,"cacheWriteTokens":0},"finalText":"","error":"Error: Insufficient credits for Command Code."}',
  ].join("\n"),
);
assert.equal(bad?.isError, true);
assert.equal(bad?.error, "Error: Insufficient credits for Command Code.");
assert.equal(bad?.tokensIn, 0);

// no result line: not parseable
assert.equal(parseCommandCode("not json"), null);

// the Freebuff driver always ends with a JSON line the claude-json parser reads, even when it cannot start
const fb = spawnSync(process.execPath, ["scripts/freebuff_drive.cjs", "run", "--cwd", ".", "--prompt-file", "nope.txt"], {
  encoding: "utf8",
  env: { ...process.env, FREEBUFF_BIN: "/no/such/freebuff" },
});
const last = JSON.parse(fb.stdout.trim().split("\n").pop()!);
assert.equal(last.is_error, true);
assert.match(fb.stdout, /error: crash: (Freebuff binary not found|node-pty not found)/);

// an empty ACP reply (cline hides the provider error) is re-checked through the backend's own CLI:
// a 429 there makes it a rate limit, so the cooldown fits; a backend without a CLI run keeps no_response
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-probe-"));
const fake = path.join(tmp, "oh.sh").replace(/\\/g, "/");
fs.writeFileSync(fake, `#!/bin/sh
echo 'error: no response from ACP server (the backend may not serve this model)'
echo '{"result": "", "is_error": true, "total_cost_usd": 0, "usage": {}}'
exit 1
`, { mode: 0o755 });
const probeRun = async (backendRun?: ProviderConfig["run"]) => {
  const bpc = { kind: "cli", enabled: true, command: "sh", billing: "free", parse: "text", run: backendRun } as ProviderConfig;
  const pc = { kind: "openhands", enabled: true, command: fake, billing: "free", backends: { cline: { command: "cline --acp", modes: { readonly: "plan" } } } } as unknown as ProviderConfig;
  const oh = new OpenHandsAdapter("openhands", pc, [{ id: "cline", pc: bpc, adapter: new CliAdapter("cline", bpc) }]);
  return oh.run({ model: "cline/some/model:free", mode: "readonly", prompt: "x", cwd: tmp, timeoutMs: 30_000, logFile: path.join(tmp, `t${Math.random()}.log`), title: "probe test" });
};
assert.equal((await probeRun({ readonly: "echo 'request failed with status 429: Daily limit reached'; exit 1" })).failure, "rate_limit");
assert.equal((await probeRun()).failure, "no_response");
assert.equal((await probeRun({ readonly: "echo 'OK, all good here and answering fine.'" })).failure, "no_response", "a probe that works keeps the original class");

// a prestarted daemon is stopped when the engine process exits (Cline's hub outlived every run)
const stopped = path.join(tmp, "stopped").replace(/\\/g, "/");
const child = [
  `import { CliAdapter } from ${JSON.stringify(pathToFileURL(path.resolve("src/adapters/cli.ts")).href)};`,
  `const pc = { kind: "cli", enabled: true, command: "sh", billing: "free", parse: "text", prestart: "true", poststop: "touch '${stopped}'", run: { readonly: "echo hello there, a long enough answer" } };`,
  `await new CliAdapter("d", pc).run({ model: "m", mode: "readonly", prompt: "x", cwd: ${JSON.stringify(tmp.replace(/\\/g, "/"))}, timeoutMs: 30000, logFile: ${JSON.stringify(path.join(tmp, "d.log").replace(/\\/g, "/"))}, title: "d" });`,
].join("\n");
const cp = spawnSync(process.execPath, ["--input-type=module", "-e", child], { encoding: "utf8" });
assert.equal(cp.status, 0, cp.stderr);
assert.ok(fs.existsSync(stopped), "poststop ran at exit");

console.log("adapters PASS");
