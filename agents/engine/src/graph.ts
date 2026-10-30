// Graphify code map -> vault/Code/<project>/. Uses `graphify update` (AST only,
// no LLM, no tokens), then exports one Obsidian note per code node and community.
import fs from "node:fs";
import path from "node:path";
import type { Project } from "./types.ts";
import { ENGINE, git, posix, shell } from "./util.ts";

/** Graphify's graph.json is a networkx node-link graph: nodes carry the file they live in, links the relation. */
interface GraphNode {
  id?: string | number;
  source_file?: string;
}
interface GraphLink {
  source?: string | number;
  target?: string | number;
  relation?: string;
  source_file?: string;
}

/**
 * Files next to the given files, one "<from> <relation> <to>" line per link.
 * A link counts when its two nodes live in different files and exactly one of them is in `files`.
 */
export function fileNeighbours(graphFile: string, files: string[], max = 25): string[] {
  if (!fs.existsSync(graphFile)) return [];
  let graph: { nodes?: GraphNode[]; links?: GraphLink[] };
  try {
    graph = JSON.parse(fs.readFileSync(graphFile, "utf8"));
  } catch {
    return [];
  }
  const nodeFile = new Map<string, string>();
  for (const n of Array.isArray(graph.nodes) ? graph.nodes : [])
    if (n?.id != null && n.source_file) nodeFile.set(String(n.id), posix(n.source_file));
  const wanted = files.map(posix);
  const inFiles = (f: string) => wanted.some((w) => w === f || (w.endsWith("/") && f.startsWith(w)));
  const out = new Set<string>();
  for (const l of Array.isArray(graph.links) ? graph.links : []) {
    // graphify emits "imports" and "imports_from" for the same import: normalise so it is one line
    const relation = (l.relation ?? "").trim().replace(/_from$/, "");
    const sid = l.source == null ? "" : String(l.source);
    const tid = l.target == null ? "" : String(l.target);
    // an unknown source node still tells its file: the link was found there
    const from = sid ? (nodeFile.get(sid) ?? (l.source_file ? posix(l.source_file) : "")) : "";
    const to = tid ? (nodeFile.get(tid) ?? "") : "";
    if (!relation || !from || !to || from === to) continue;
    if (inFiles(from) === inFiles(to)) continue; // both sides in the given files, or neither: not a neighbour
    out.add(`${from} ${relation} ${to}`);
  }
  return [...out].sort().slice(0, max);
}

export async function buildCodeGraph(p: Project, vaultCode: string, graphify = "graphify") {
  const env = { PYTHONIOENCODING: "utf-8" };
  if (!(await shell(`command -v ${graphify}`, { cwd: p.repo, timeoutMs: 10_000 })).out.trim())
    throw new Error("Graphify not found. Install it (needs Python): pip install graphifyy");
  // keep graphify-out/ out of the owner's git status
  const exclude = path.join(p.repo, ".git", "info", "exclude");
  if (fs.existsSync(path.dirname(exclude)) && !(fs.existsSync(exclude) && fs.readFileSync(exclude, "utf8").includes("graphify-out/")))
    fs.appendFileSync(exclude, "\ngraphify-out/\n");
  const r = await shell(`${graphify} update . --force`, { cwd: p.repo, timeoutMs: 60 * 60_000, env });
  const src = path.join(p.repo, "graphify-out");
  if (!fs.existsSync(path.join(src, "graph.json"))) throw new Error(`graphify failed:\n${r.out.slice(-2000)}`);
  fs.rmSync(vaultCode, { recursive: true, force: true });
  fs.mkdirSync(vaultCode, { recursive: true });
  for (const f of ["GRAPH_REPORT.md", "graph.json", "graph.html"]) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(vaultCode, f));
  const script = posix(path.join(ENGINE, "scripts", "graphify_obsidian.py"));
  const notes = await shell(`python -I '${script}' '${posix(path.join(vaultCode, "graph.json"))}' '${posix(path.join(vaultCode, "notes"))}'`, { cwd: vaultCode, timeoutMs: 10 * 60_000, env });
  const summary = r.out.match(/Rebuilt: ([^\r\n]+)/)?.[1] ?? "graph built";
  return { summary, notes: Number(notes.out.trim().split("\n").pop()) || 0, head: git(p.repo, "rev-parse", "--short", "HEAD").out };
}
