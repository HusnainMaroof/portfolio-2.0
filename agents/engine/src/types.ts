// Shared types for the engine and the CLI.
import type { WatchInfo } from "./util.ts";

export type Mode = "edit" | "readonly";
export type Risk = "low" | "medium" | "high";
export type Tier = "light" | "standard" | "strong" | "premium";
export const TIERS: Tier[] = ["light", "standard", "strong", "premium"];
export const CATEGORIES = ["coding", "debugging", "testing", "research", "review", "architecture", "docs"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Failure = "rate_limit" | "auth" | "not_found" | "no_response" | "crash" | "timeout" | "stalled" | "bad_output";
export type Terse = "off" | "lite" | "full" | "ultra";

export interface ModelInfo {
  key: string; // "<adapter>:<model>"
  adapter: string;
  model: string;
  tier: Tier;
  free: boolean;
  contextLength?: number;
  priceIn?: number; // USD per 1M input tokens
  priceOut?: number;
  modes: Mode[];
}

export interface RunRequest {
  model: string;
  mode: Mode;
  prompt: string;
  cwd: string;
  timeoutMs: number;
  idleMs?: number; // kill when the agent prints nothing for this long
  watchMs?: number; // check-in interval: stop the agent when it loops or makes no progress
  onWatch?: (w: WatchInfo) => void;
  killMarkers?: string[]; // strings unique to this agent's command line (see killTree)
  logFile: string;
  title: string;
  // edit mode for API models (they cannot touch files): files they may rewrite
  allowedFiles?: string[];
}

export interface RunResult {
  ok: boolean;
  text: string; // the agent's final answer / report
  exitCode: number | null;
  latencyMs: number;
  tokensIn: number;
  tokensCached?: number;
  tokensOut: number;
  costUsd: number;
  failure?: Failure;
  filesWritten?: string[];
}

export interface Adapter {
  id: string;
  kind: "cli" | "api" | "mock";
  modes: Mode[];
  available(): Promise<boolean>;
  discover(): Promise<ModelInfo[]>;
  run(req: RunRequest): Promise<RunResult>;
}

export interface Check {
  name: string;
  cmd: string;
  // measure: the last number the command prints is a metric (e.g. latency ms)
  measure?: boolean;
  expect?: "pass" | "lower" | "higher";
}

export interface Evidence {
  changed: { file: string; status: string; inScope: boolean }[];
  scopeOk: boolean;
  checks: { name: string; cmd: string; ok: boolean; exitCode: number | null; value?: number; baseline?: number; tail: string }[];
  checksOk: boolean;
  /** Why the checks were not run (no changes, or only out-of-scope changes). */
  checksSkipped?: string;
  diffLines: number;
  diffFile: string;
  /** Out-of-scope edits the engine undid before running the checks (the in-scope work was kept). */
  reverted?: string[];
}

export interface Review {
  model: string;
  score: number; // 0..100
  verdict: string;
  findings: { severity: string; file?: string; issue: string }[];
}

export type Decision = "accept" | "retry" | "reassign" | "escalate";

export interface Attempt {
  n: number;
  model: string; // ModelInfo key
  startedAt: string;
  latencyMs: number;
  exitCode: number | null;
  failure?: Failure;
  costUsd: number;
  tokensIn: number;
  tokensCached?: number;
  tokensOut: number;
  reportFile: string;
  blocked: string[];
  evidence?: Evidence;
  review?: Review;
  decision?: Decision;
  reason?: string;
}

export interface Task {
  id: string;
  title: string;
  category: Category;
  risk: Risk;
  brief: string;
  files: string[]; // allowed files / folders (folder ends with /) / globs
  deps: string[];
  checks: Check[];
  status: "pending" | "running" | "accepted" | "failed" | "skipped";
  attempts: Attempt[];
  excluded: string[]; // model keys not to use again on this task
  reassigns: number;
  minTier?: Tier;
  candidates?: { key: string; score: number; why: string }[];
  critique?: string;
  branch?: string;
  worktree?: string;
  baseline?: Record<string, number>;
  approvalReason?: string;
  forceModel?: string; // benchmarks: evaluate exactly this model
  timeoutMin?: number; // overrides the agent profile
  reportMatch?: string[]; // read-only tasks: regexes the report must match
}

export interface Project {
  name: string;
  repo: string;
  baseBranch: string;
  allowedCommands: string[]; // check commands must start with one of these, else owner approval
  linkDirs: string[]; // folders shared into worktrees by junction (node_modules, .venv)
  context: string; // free text from the project note
}

export interface Waiting {
  kind: "approval" | "escalation" | "question";
  taskId?: string;
  question: string;
  options: string[];
}

/** waiting: holds the run's question; parked: reached a human node while another lane held it. */
export interface Lane {
  task: string;
  cursor: string;
  state: "running" | "waiting" | "parked" | "done";
}

export interface RunState {
  id: string;
  project: Project;
  request: string;
  workflow: string;
  status: "running" | "waiting" | "done" | "failed" | "aborted";
  waiting?: Waiting;
  input?: { choice: string; note?: string }; // the owner's answer to `waiting`
  cursor: string;
  visits: Record<string, number>;
  understanding?: { goal: string; constraints: string[]; successCriteria: string[]; assumptions: string[]; questions: string[] };
  tasks: Task[];
  currentTask?: string;
  /** Tasks running side by side from a tasks.next node; each walks the task loop with its own cursor. */
  lanes?: Lane[];
  integrationBranch: string;
  integrationWorktree?: string;
  costUsd: number; // billed (metered APIs), counts against the budget
  usageUsd?: number; // equivalent cost of subscription CLIs, informational
  senior?: string[]; // senior model keys chosen for this run (first wins); default: config senior + fallback
  createdAt: string;
  updatedAt: string;
  error?: string;
}

/* ---- workflow graph (n8n-shaped nodes and port edges) ---- */
export interface WorkflowNode {
  id: string;
  type: string;
  name?: string;
  params?: Record<string, unknown>;
  position?: [number, number];
}
export interface WorkflowEdge {
  from: string;
  port?: string; // output port of `from`, default "out"
  to: string;
}
export interface Workflow {
  name: string;
  description?: string;
  start: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ParamSpec {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  default?: unknown;
  options?: string[];
  description: string;
}

export const WAIT = "__wait__";
