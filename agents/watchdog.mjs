#!/usr/bin/env node
// Watchdog for one orchestrator run. Covers what the engine's own check-in does not:
//   - an agent whose log has gone silent (the engine only watches agents that stream)
//   - the orchestrator process dying or hanging mid-run
//   - a run parked on an escalation or a failure with nobody answering
// "Restart" means: kill the stuck agent (the engine then retries or reassigns the task),
// or `orch resume` the run. Plan approvals and owner questions are never answered here.
//
//   node agents/watchdog.mjs <run> [--every 180] [--stall 15] [--hang 45] [--max 3] [--dry] [--once]
//
// Log: agents/vault/Runs/<run>/watchdog.log (and stdout).

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const [run, ...rest] = process.argv.slice(2);
if (!run) {
    console.error('usage: node agents/watchdog.mjs <run> [--every 180] [--stall 15] [--hang 45] [--max 3]');
    process.exit(2);
}
const opt = (name, def) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? Number(rest[i + 1]) : def;
};
const EVERY_S = opt('every', 180);
const STALL_MIN = opt('stall', 15); // silent agent log
const HANG_MIN = opt('hang', 45); // no run event at all, with no live agent
const MAX = opt('max', 3); // restarts per task / per run before leaving it to the owner
const DRY = rest.includes('--dry'); // report what it would do, change nothing
const ONCE = rest.includes('--once');

const runDir = path.join(root, 'agents', 'vault', 'Runs', run);
const logsDir = path.join(runDir, 'logs');
const logFile = path.join(runDir, 'watchdog.log');
const title = `orch-${createHash('sha1').update(run).digest('hex').slice(0, 8)}-`;
const counts = new Map(); // task id or "run" -> restarts done

const log = (msg) => {
    const line = `${new Date().toTimeString().slice(0, 8)}  ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
};
const minutesSince = (file) => (Date.now() - fs.statSync(file).mtimeMs) / 60000;
const bump = (key) => {
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n;
};
const alive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

/** Windows processes with their command lines (one PowerShell call per tick). */
const processes = () => {
    try {
        const out = execFileSync(
            'powershell.exe',
            ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
        );
        return JSON.parse(out).filter((p) => p.CommandLine);
    } catch {
        return [];
    }
};

const killTree = (pid) => {
    if (DRY) return true;
    try {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};

/** Resume in the background with the same free-only config the run started with. */
const resume = (args, why) => {
    if (DRY) return log(`(dry) would run: orch resume ${args.join(' ')} (${why})`);
    const out = fs.openSync(path.join(runDir, 'watchdog-resume.log'), 'a');
    const child = spawn(process.execPath, [path.join(root, 'agents', 'engine', 'src', 'cli.ts'), 'resume', run, ...args], {
        cwd: root,
        env: { ...process.env, ORCH_CONFIG: process.env.ORCH_CONFIG ?? 'agents/config/free-only.json' },
        detached: true,
        stdio: ['ignore', out, out],
        windowsHide: true,
    });
    child.unref();
    log(`RESTART run: orch resume ${args.join(' ')} (${why})`);
};

const ownerPid = () => {
    const f = path.join(runDir, '.lock');
    if (!fs.existsSync(f)) return null;
    try {
        const { pid } = JSON.parse(fs.readFileSync(f, 'utf8'));
        return pid && alive(pid) ? pid : null;
    } catch {
        return null;
    }
};

/** Agents still running for this run: a process whose command line names one of its logs. */
const liveAgents = (procs) => {
    if (!fs.existsSync(logsDir)) return [];
    return fs
        .readdirSync(logsDir)
        .filter((f) => f.endsWith('.log'))
        .map((f) => f.slice(0, -4))
        .flatMap((name) => {
            const p = procs.find(
                (x) => x.CommandLine.includes(`${name}.prompt.txt`) || x.CommandLine.includes(`${title}${name}"`) || x.CommandLine.includes(`${title}${name})`),
            );
            return p ? [{ name, pid: p.ProcessId, task: name.replace(/-a\d+.*$/, ''), file: path.join(logsDir, `${name}.log`) }] : [];
        });
};

const tick = () => {
    const stateFile = path.join(runDir, 'state.json');
    if (!fs.existsSync(stateFile)) return log('no state.json yet');
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const done = s.tasks.filter((t) => ['accepted', 'skipped', 'failed'].includes(t.status)).length;
    const status = `${s.status} ${done}/${s.tasks.length}`;

    if (s.status === 'done' || s.status === 'aborted') {
        log(`run ${status}: watchdog exits`);
        process.exit(0);
    }

    if (s.status === 'failed') {
        if (bump('run') > MAX) return log(`run failed again, ${MAX} restarts used: needs the owner`);
        return resume([], 'run failed');
    }

    if (s.status === 'waiting') {
        const w = s.waiting ?? {};
        const task = w.task ?? s.currentTask ?? '?';
        if (w.kind !== 'escalation') return log(`waiting (${w.kind}): needs the owner, not auto-answered`);
        if (bump(task) > MAX) return log(`escalation on ${task}: ${MAX} restarts used, needs the owner`);
        return resume(['--choice', 'reassign', '--note', 'watchdog: escalation unanswered, reassigning to the next model'], `escalation on ${task}`);
    }

    // running
    const owner = ownerPid();
    if (!owner) {
        if (bump('run') > MAX) return log(`orchestrator gone again, ${MAX} restarts used: needs the owner`);
        return resume([], 'orchestrator process is gone');
    }

    const agents = liveAgents(processes());
    for (const a of agents) {
        const quiet = minutesSince(a.file);
        if (quiet < STALL_MIN) continue;
        if (bump(a.task) > MAX) {
            log(`${a.name} silent ${quiet.toFixed(0)} min, ${MAX} restarts used on ${a.task}: left to the engine timeout`);
            continue;
        }
        log(`STUCK ${a.name}: log silent ${quiet.toFixed(0)} min; killing pid ${a.pid} so the engine retries or reassigns`);
        if (!killTree(a.pid)) log(`could not kill pid ${a.pid}`);
    }

    const events = path.join(runDir, 'events.jsonl');
    const idle = fs.existsSync(events) ? minutesSince(events) : 0;
    if (agents.length === 0 && idle >= HANG_MIN) {
        if (bump('run') > MAX) return log(`run idle ${idle.toFixed(0)} min, ${MAX} restarts used: needs the owner`);
        log(`HANG: no event for ${idle.toFixed(0)} min and no live agent; killing orchestrator pid ${owner}`);
        killTree(owner);
        return resume([], 'orchestrator hung');
    }

    log(`ok ${status}; live agents: ${agents.map((a) => `${a.name} (${minutesSince(a.file).toFixed(0)}m quiet)`).join(', ') || 'none'}`);
};

log(`watchdog${DRY ? ' (dry)' : ''} on ${run}: every ${EVERY_S}s, stall ${STALL_MIN}m, hang ${HANG_MIN}m, max ${MAX} restarts`);
tick();
if (!ONCE) setInterval(tick, EVERY_S * 1000);
