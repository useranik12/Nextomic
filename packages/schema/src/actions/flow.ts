import { z } from "zod";
import { conditionGroupSchema, type ConditionGroup } from "../condition";
import { paramsSchema, type Params } from "./fields";

// Action flow nodes (docs/dynamic-data-and-actions.md section 8.3). Every step is a node; the editor
// lays them out top to bottom. Containers hold child node lists: condition branches (if, else if,
// else), loop bodies, parallel lanes, try and catch. Flows are saved apart from the page tree,
// one record per owner (element, page root or template root).

export const MAX_FLOW_NODES = 500;
export const MAX_FLOW_DEPTH = 10;
export const MAX_LOOP_ITERATIONS = 10_000;

interface NodeBase {
  id: string;
  /** Name shown on the node instead of the action label. */
  name?: string | undefined;
  /** Disabled nodes (and everything inside them) are skipped. */
  disabled?: boolean | undefined;
}

export interface ActionNode extends NodeBase {
  kind: "action";
  /** Catalog action type; empty = "Not defined", which counts as an error. */
  type: string;
  params: Params;
  /** Name of the output variable later nodes read; empty = the output is not kept. */
  outputName?: string | undefined;
  /** Nested flows of the action's `flow` fields (Show Toast's Button Action), by field key. */
  slots?: Record<string, FlowNode[]> | undefined;
}

export interface ConditionBranch {
  id: string;
  group: ConditionGroup;
  nodes: FlowNode[];
}

export interface ConditionNode extends NodeBase {
  kind: "condition";
  /** The first branch is "if", the rest are "else if". */
  branches: ConditionBranch[];
  else?: FlowNode[] | undefined;
}

export interface LoopNode extends NodeBase {
  kind: "loop";
  mode: "forEach" | "while";
  /** forEach: the list, usually one {{ tag }}. */
  list: string;
  /** forEach: the name nodes in the body read the current item and index by (generated). */
  itemName: string;
  /** forEach: first index (text, may hold a tag); empty means 0. */
  start: string;
  /** forEach: last index, inclusive; empty means the end of the list. */
  end: string;
  /** forEach: index step; empty means 1. */
  step: string;
  /** while: repeats while this holds. */
  condition?: ConditionGroup | undefined;
  /** Safety cap on the number of rounds. */
  maxIterations: number;
  nodes: FlowNode[];
}

export interface BreakNode extends NodeBase {
  kind: "break";
}

export interface ContinueNode extends NodeBase {
  kind: "continue";
}

export interface ParallelLane {
  id: string;
  nodes: FlowNode[];
}

export interface ParallelNode extends NodeBase {
  kind: "parallel";
  lanes: ParallelLane[];
}

export interface TryCatchNode extends NodeBase {
  kind: "tryCatch";
  try: FlowNode[];
  catch: FlowNode[];
  /** The name catch nodes read the error by ({ code, message }). */
  errorName: string;
}

export interface BlockCallNode extends NodeBase {
  kind: "block";
  blockId: string;
  /** Values by block parameter id. */
  params: Params;
  outputName?: string | undefined;
}

export type FlowNode =
  | ActionNode
  | ConditionNode
  | LoopNode
  | BreakNode
  | ContinueNode
  | ParallelNode
  | TryCatchNode
  | BlockCallNode;

export type FlowNodeKind = FlowNode["kind"];

const id = z.string().min(1).max(64);
const base = {
  id,
  name: z.string().max(100).optional(),
  disabled: z.boolean().optional()
};
const outputName = z.string().max(64).optional();

export const flowNodeSchema: z.ZodType<FlowNode, z.ZodTypeDef, unknown> = z.lazy(() => {
  const nodes = z.array(flowNodeSchema).max(MAX_FLOW_NODES);
  return z.discriminatedUnion("kind", [
    z.object({
      ...base,
      kind: z.literal("action"),
      type: z.string().max(64),
      params: paramsSchema,
      outputName,
      slots: z.record(z.string().max(64), nodes).optional()
    }),
    z.object({
      ...base,
      kind: z.literal("condition"),
      branches: z
        .array(z.object({ id, group: conditionGroupSchema, nodes }))
        .min(1)
        .max(20),
      else: nodes.optional()
    }),
    z.object({
      ...base,
      kind: z.literal("loop"),
      mode: z.enum(["forEach", "while"]),
      list: z.string().max(2000).default(""),
      itemName: z.string().max(64).default("item"),
      start: z.string().max(2000).default(""),
      end: z.string().max(2000).default(""),
      step: z.string().max(2000).default(""),
      condition: conditionGroupSchema.optional(),
      maxIterations: z.number().int().min(1).max(MAX_LOOP_ITERATIONS).default(1000),
      nodes
    }),
    z.object({ ...base, kind: z.literal("break") }),
    z.object({ ...base, kind: z.literal("continue") }),
    z.object({
      ...base,
      kind: z.literal("parallel"),
      lanes: z.array(z.object({ id, nodes })).min(1).max(10)
    }),
    z.object({
      ...base,
      kind: z.literal("tryCatch"),
      try: nodes,
      catch: nodes,
      errorName: z.string().max(64).default("error")
    }),
    z.object({
      ...base,
      kind: z.literal("block"),
      blockId: id,
      params: paramsSchema,
      outputName
    })
  ]);
});

export interface TriggerFlow {
  id: string;
  /** Trigger id from `triggers.ts`. */
  trigger: string;
  disabled?: boolean | undefined;
  /** The trigger's own settings (hold time, viewport line, key...). */
  settings: Params;
  nodes: FlowNode[];
}

export const triggerFlowSchema: z.ZodType<TriggerFlow, z.ZodTypeDef, unknown> = z.object({
  id,
  trigger: z.string().min(1).max(64),
  disabled: z.boolean().optional(),
  settings: paramsSchema,
  nodes: z.array(flowNodeSchema).max(MAX_FLOW_NODES).default([])
});

/** Every flow of one owner; one flow per trigger. */
export const ownerFlowsSchema = z
  .array(triggerFlowSchema)
  .max(100)
  .superRefine((flows, ctx) => {
    const seen = new Set<string>();
    flows.forEach((flow, i) => {
      if (seen.has(flow.trigger)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "trigger"],
          message: "Each trigger can have one flow."
        });
      }
      seen.add(flow.trigger);
    });
  });

/** The child node lists of a node (none for break, continue, Action Block calls and plain actions). */
export function childLists(node: FlowNode): FlowNode[][] {
  switch (node.kind) {
    case "action":
      return Object.values(node.slots ?? {});
    case "condition":
      return [...node.branches.map((b) => b.nodes), ...(node.else ? [node.else] : [])];
    case "loop":
      return [node.nodes];
    case "parallel":
      return node.lanes.map((l) => l.nodes);
    case "tryCatch":
      return [node.try, node.catch];
    default:
      return [];
  }
}

/** Visits every node depth first, with the chain of its ancestors (outermost first). */
export function walkFlow(
  nodes: readonly FlowNode[],
  visit: (node: FlowNode, ancestors: readonly FlowNode[]) => void,
  ancestors: readonly FlowNode[] = []
): void {
  for (const node of nodes) {
    visit(node, ancestors);
    for (const list of childLists(node)) walkFlow(list, visit, [...ancestors, node]);
  }
}

/** Number of enabled action and Action Block nodes, skipping disabled containers. */
export function countEnabledActions(nodes: readonly FlowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.disabled) continue;
    if (node.kind === "action" || node.kind === "block") count += 1;
    for (const list of childLists(node)) count += countEnabledActions(list);
  }
  return count;
}

export function countNodes(nodes: readonly FlowNode[]): number {
  let count = 0;
  walkFlow(nodes, () => {
    count += 1;
  });
  return count;
}

export function flowDepth(nodes: readonly FlowNode[]): number {
  let depth = 0;
  walkFlow(nodes, (_node, ancestors) => {
    depth = Math.max(depth, ancestors.length + 1);
  });
  return depth;
}

/** A name a node can read: an earlier node's output, a loop's item, or a catch's error. */
export interface FlowName {
  name: string;
  kind: "output" | "loopItem" | "error";
  /** The action type, or "block", for an output. */
  type?: string;
  /** The node's own name, when set. */
  nodeName?: string;
}

/**
 * The names the node `nodeId` can read, in the order they are set: outputs of earlier nodes in its
 * list and in the lists around it, the item of each loop around it, and the error inside a catch.
 * Names set inside a nested list stay in it, as in the engine. Null when the node is not in `nodes`.
 */
export function flowNamesBefore(
  nodes: readonly FlowNode[],
  nodeId: string,
  inherited: readonly FlowName[] = []
): FlowName[] | null {
  const names = [...inherited];
  for (const node of nodes) {
    if (node.id === nodeId) return names;
    for (const list of childLists(node)) {
      const extra: FlowName[] = [];
      if (node.kind === "loop" && node.mode === "forEach" && node.itemName && list === node.nodes)
        extra.push({ name: node.itemName, kind: "loopItem", nodeName: node.name });
      if (node.kind === "tryCatch" && node.errorName && list === node.catch)
        extra.push({ name: node.errorName, kind: "error", nodeName: node.name });
      const found = flowNamesBefore(list, nodeId, [...names, ...extra]);
      if (found) return found;
    }
    if ((node.kind === "action" || node.kind === "block") && node.outputName)
      names.push({
        name: node.outputName,
        kind: "output",
        type: node.kind === "action" ? node.type : "block",
        nodeName: node.name
      });
  }
  return null;
}
