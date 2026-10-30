import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ROOT: the agents/ folder (config, vault, tasks); ENGINE: agents/engine (code, workflows, scripts, benchmarks)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ENGINE = path.join(ROOT, "engine");

// Git Bash on Windows; override when bash is elsewhere (never WSL bash: wrong filesystem)
export const BASH = process.env.ORCH_BASH || "bash";

export const now = () => new Date().toISOString();
export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
export const posix = (p: string) => p.replace(/\\/g, "/");

export function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback;
}
export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
export function writeText(file: string, text: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// git reads GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE from the env, so a leak from an agent shell would send the engine's git to another repo than cwd
const GIT_ENV_LEAKS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"];

export const git = (cwd: string, ...args: string[]) => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (GIT_ENV_LEAKS.includes(k.toUpperCase())) delete env[k];
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, env });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
};

export interface ShellResult {
  code: number | null;
  out: string;
  timedOut: boolean;
  stalled: boolean; // killed after idleMs without any output, or by the watch (looping, no progress)
  ms: number;
}

/** What the watch saw in one window of an agent's output. */
export interface WatchInfo {
  minutes: number;
  newLines: number; // meaningful lines printed in this window
  repeated: number; // of those, lines already printed earlier
  verdict: "ok" | "looping" | "no progress";
}

/**
 * One watch window: an agent that keeps printing but only repeats itself (a model restating the same
 * question for minutes, found in a real Freebuff run) or prints nothing but heartbeats is not working.
 * Numbers are masked so "12 s" and "40 s" compare equal; "[heartbeat]" lines never count as progress.
 */
export function watchWindow(chunk: string, seen: Set<string>): Omit<WatchInfo, "minutes"> {
  const lines = chunk
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\d+/g, "#").replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 8 && !l.startsWith("[heartbeat]"));
  const repeated = lines.filter((l) => seen.has(l)).length;
  for (const l of lines) seen.add(l);
  const verdict = lines.length === 0 ? "no progress" : lines.length >= 10 && repeated / lines.length >= 0.85 ? "looping" : "ok";
  return { newLines: lines.length, repeated, verdict };
}

/** Runs a bash script, streams output to logFile, kills the whole tree on timeout. */
export function shell(
  script: string,
  opts: {
    cwd: string;
    timeoutMs: number;
    idleMs?: number;
    logFile?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
    killMarkers?: string[];
    /** check the output every watchMs; stop the agent when it loops or makes no progress */
    watchMs?: number;
    onWatch?: (w: WatchInfo) => void;
  },
): Promise<ShellResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (GIT_ENV_LEAKS.includes(k.toUpperCase())) delete env[k];
    Object.assign(env, opts.env);
    // nested Claude Code sessions refuse to start while this is set
    delete env.CLAUDECODE;
    const child = spawn(BASH, ["-c", script], { cwd: opts.cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    const log = opts.logFile ? fs.createWriteStream(opts.logFile, { flags: "a" }) : null;
    let out = "";
    let pending = ""; // output since the last watch window
    let lastOutput = Date.now();
    const take = (b: Buffer) => {
      lastOutput = Date.now();
      const s = b.toString();
      out += s;
      if (out.length > 4_000_000) out = out.slice(-2_000_000);
      if (opts.watchMs) pending = (pending + s).slice(-1_000_000);
      log?.write(s);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    if (opts.input !== undefined) child.stdin.end(opts.input);
    else child.stdin.end();
    let timedOut = false;
    let stalled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid, opts.killMarkers);
    }, opts.timeoutMs);
    // a hung agent prints nothing; stop it instead of waiting for the hard timeout
    const idle = opts.idleMs
      ? setInterval(() => {
          if (Date.now() - lastOutput > opts.idleMs!) {
            stalled = true;
            killTree(child.pid, opts.killMarkers);
          }
        }, 15_000)
      : undefined;
    // the supervisor's check-in: every window, is the agent still making progress?
    const seen = new Set<string>();
    const watch = opts.watchMs
      ? setInterval(() => {
          const w = { minutes: Math.round((Date.now() - started) / 60_000), ...watchWindow(pending, seen) };
          pending = "";
          opts.onWatch?.(w);
          if (w.verdict !== "ok") {
            stalled = true;
            out += `\n[engine] stopped by the watch: ${w.verdict} (${w.newLines} new lines, ${w.repeated} repeated)\n`;
            killTree(child.pid, opts.killMarkers);
          }
        }, opts.watchMs)
      : undefined;
    let done = false;
    const finish = (code: number | null, extra = "") => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (idle) clearInterval(idle);
      if (watch) clearInterval(watch);
      log?.end();
      resolve({ code, out: out + extra, timedOut, stalled, ms: Date.now() - started });
    };
    child.on("close", (code) => finish(code));
    // "close" waits for every inherited pipe; a surviving grandchild would keep it open
    // forever, so after the process itself exits allow a moment for output, then move on
    child.on("exit", (code) =>
      setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        finish(code);
      }, 1500),
    );
    child.on("error", (e) => finish(-1, String(e)));
  });
}

/**
 * Kills a process and everything it started. On Windows, Git Bash starts native programs
 * through a helper, so the agent is not a Windows child of our bash and taskkill /T misses
 * it; markers (strings unique to the agent's command line, such as its title or worktree
 * path) catch those processes too.
 */
export function killTree(pid?: number, markers: string[] = []) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    const safe = markers.filter((m) => m.length >= 12).map((m) => m.replace(/'/g, "''").replace(/[[\]*?`]/g, "?"));
    if (safe.length) {
      const filter = safe.map((m) => `$_.CommandLine -like '*${m}*'`).join(" -or ");
      spawnSync(
        "powershell",
        ["-NoProfile", "-Command", `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.ProcessId -ne ${process.pid} -and (${filter}) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
        { timeout: 30_000 },
      );
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

export const commandExists = (name: string) =>
  spawnSync(BASH, ["-c", `command -v ${name}`], { encoding: "utf8" }).status === 0;

/** Pulls the first JSON object out of an LLM answer (fenced or bare). */
export function extractJson<T>(text: string): T | null {
  const fenced = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = [...fenced.reverse(), text];
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1)) as T;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

export const tail = (s: string, lines = 15) => s.trim().split("\n").slice(-lines).join("\n");

/** Matches a repo path against allowed entries: exact file, folder ("src/"), or glob ("src/*.ts", "src/**"). */
export function inScope(file: string, allowed: string[]): boolean {
  const f = posix(file);
  return allowed.some((raw) => {
    const a = posix(raw).replace(/^\.\//, "");
    if (a.includes("*")) {
      const re = new RegExp(
        "^" + a.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$",
      );
      return re.test(f);
    }
    return f === a || f.startsWith(a.endsWith("/") ? a : a + "/");
  });
}
