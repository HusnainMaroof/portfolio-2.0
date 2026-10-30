// orch setup: prepare a fresh clone (local config, Claude Code skills, which agent CLIs are installed).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../src/config.ts";
import { ROOT, commandExists, shell, tail, writeJson } from "../src/util.ts";

const ABOUT = "This machine's overrides of config/orchestrator.json (same shape, merged on top, git-ignored).";

/** Creates config/local.json when it is missing. An existing one is never touched. */
export function writeLocal(root: string): boolean {
  const file = path.join(root, "config", "local.json");
  if (fs.existsSync(file)) return false;
  writeJson(file, { _about: ABOUT });
  return true;
}

/** One line per enabled cli provider: the tool is there, or it is not. */
export function toolReport(providers: Record<string, { kind: string; enabled?: boolean; command?: string }>): string[] {
  return Object.entries(providers)
    .filter(([, p]) => p.kind === "cli" && p.enabled)
    .map(([name, p]) => {
      const cmd = (p.command ?? "").trim();
      if (cmd && commandExists(cmd)) return `${"ok".padEnd(8)}${name} (${cmd})`;
      return `${"missing".padEnd(8)}${name} (${cmd}): install it or set enabled false in config/local.json`;
    });
}

/**
 * Copies agents/skills/* into <project>/.claude/skills/, where Claude Code looks for them: agents/ is
 * a drop-in folder, so the skills travel inside it and land in whichever project it sits in.
 */
export function installSkills(root: string, project: string): string[] {
  const from = path.join(root, "skills");
  if (!fs.existsSync(from)) return [];
  const names = fs.readdirSync(from).filter((n) => fs.existsSync(path.join(from, n, "SKILL.md")));
  for (const n of names) fs.cpSync(path.join(from, n), path.join(project, ".claude", "skills", n), { recursive: true });
  return names;
}

export async function main(argv = process.argv) {
  const created = writeLocal(ROOT);
  console.log(created ? "created config/local.json" : "config/local.json exists, left alone");
  const skills = installSkills(ROOT, path.resolve(ROOT, ".."));
  console.log(skills.length ? `skills for Claude Code in ../.claude/skills: ${skills.join(", ")}` : "no skills to install");
  for (const line of toolReport(loadConfig().providers)) console.log(line);

  if (argv.includes("--openhands")) {
    if (!commandExists("uv")) {
      console.log("uv is needed to install the openhands runtime: https://docs.astral.sh/uv/");
    } else {
      const r = await shell(
        'uv venv --python 3.12 "$HOME/.orch/openhands-venv" && uv pip install --python "$HOME/.orch/openhands-venv" openhands-sdk openhands-tools',
        { cwd: ROOT, timeoutMs: 900_000 },
      );
      console.log(tail(r.out));
      if (r.code !== 0) console.log(`openhands install failed (exit ${r.code})`);
    }
  }

  // Freebuff has no headless mode; engine/scripts/freebuff_drive.cjs drives its TUI through node-pty,
  // kept outside the repo like the openhands venv so the orchestrator itself stays dependency-free
  if (argv.includes("--freebuff")) {
    const r = await shell('npm install --no-audit --no-fund --prefix "$HOME/.orch/node-pty" node-pty', { cwd: ROOT, timeoutMs: 600_000 });
    console.log(tail(r.out));
    console.log(r.code === 0 ? "node-pty installed in ~/.orch/node-pty; check with: node agents/engine/scripts/freebuff_drive.cjs probe" : `node-pty install failed (exit ${r.code})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
