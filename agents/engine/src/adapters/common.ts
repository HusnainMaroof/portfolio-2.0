import fs from "node:fs";
import path from "node:path";
import type { Failure } from "../types.ts";
import { inScope, posix } from "../util.ts";

/** Agents write their report here inside the workspace; the engine moves it out before checks. */
export const REPORT_NAME = ".orch-report.md";

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");

/** Failures caused by the provider, not the model's skill: they cool the model down but never count against its quality. */
export const INFRA_FAILURES = ["rate_limit", "auth", "not_found", "no_response"];

/** A CLI that exits 0 but whose whole "answer" is an error line did not answer. */
export const isErrorOnly = (text: string) => {
  const t = stripAnsi(text).trim();
  return t.length < 800 && /^(error|\[?error\]?:|api error|request failed)/i.test(t);
};

/** Failure class from a finished process. Only looks at the tail, and only when the run did not succeed. */
export function classify(out: string, code: number | null, timedOut: boolean, ms: number, hasAnswer: boolean): Failure | undefined {
  if (timedOut) return "timeout";
  if (code === 0 && hasAnswer) return undefined;
  const t = stripAnsi(out).slice(-4000);
  if (/rate.?limit|\b429\b|quota exceeded|too many requests|insufficient.?credits/i.test(t)) return "rate_limit";
  if (/re-?authenticat|unauthori[sz]ed|\b401\b|\b403\b|invalid api key|not logged in|login required/i.test(t)) return "auth";
  if (/model not found|unknown model|no such model|model .{0,60} (is not|not) (available|supported)|invalid model|not found for account|no endpoints found|variant has been retired|model has been (retired|removed|deprecated)/i.test(t)) return "not_found";
  // an ACP backend (cline over ACP) that hides the provider error answers nothing at once: the model is
  // likely unavailable, which is the provider's problem, not a sign of the model's skill
  if (/no response from ACP server/i.test(t)) return "no_response";
  // the shell could not even start the tool (e.g. a prompt over Windows' 32 KB command-line limit)
  if (/argument list too long/i.test(t)) return "crash";
  if (!hasAnswer && ms < 120_000) return "crash";
  if (!hasAnswer) return "bad_output";
  return undefined;
}

/**
 * File-block protocol for API models that cannot edit files themselves.
 * The model answers with whole files:
 *   <<<FILE path/to/file.ts>>>
 *   ...full new content...
 *   <<<END>>>
 * Only allowed paths inside the workspace are written.
 */
export const FILE_PROTOCOL = [
  "You cannot edit files directly. To change a file, output its COMPLETE new content in this exact format:",
  "<<<FILE relative/path/to/file>>>",
  "(full file content)",
  "<<<END>>>",
  "Output one block per changed file, only for files in the allowed list. After the blocks, write your report.",
].join("\n");

export function applyFileBlocks(text: string, cwd: string, allowed: string[]): { written: string[]; rejected: string[]; rest: string } {
  const written: string[] = [];
  const rejected: string[] = [];
  const rest = text.replace(/<<<FILE\s+([^>\n]+?)>>>\n?([\s\S]*?)\n?<<<END>>>/g, (_m, rel: string, body: string) => {
    const file = posix(rel.trim()).replace(/^\.\//, "");
    const abs = path.resolve(cwd, file);
    const inside = !path.relative(cwd, abs).startsWith("..") && !path.isAbsolute(path.relative(cwd, abs));
    if (!inside || !inScope(file, allowed)) {
      rejected.push(file);
      return "";
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body.endsWith("\n") ? body : body + "\n");
    written.push(file);
    return "";
  });
  return { written, rejected, rest: rest.trim() };
}
