// Node registry. Each node type declares its ports and parameters, so `orch nodes`
// and workflow validation can describe it without knowing the code.
import type { NodeCtx } from "../engine.ts";
import type { ParamSpec } from "../types.ts";
import { seniorNodes } from "./senior.ts";
import { flowNodes } from "./flow.ts";
import { agentNodes } from "./agent.ts";
import { benchNodes } from "./bench.ts";

export interface NodeType {
  type: string;
  label: string;
  group: "senior" | "flow" | "agent" | "verify" | "workspace" | "human" | "output";
  description: string;
  ports: string[];
  params: ParamSpec[];
  run(ctx: NodeCtx): Promise<string>;
}

export const NODE_TYPES: Record<string, NodeType> = Object.fromEntries(
  [...seniorNodes, ...flowNodes, ...agentNodes, ...benchNodes].map((n) => [n.type, n]),
);
