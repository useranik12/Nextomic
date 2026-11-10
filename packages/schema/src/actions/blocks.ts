import { z } from "zod";
import { IDENTIFIER_PATTERN, STATE_TYPES, type StateType } from "../state";
import { flowNodeSchema, MAX_FLOW_NODES, walkFlow, type FlowNode } from "./flow";

// Action Blocks: reusable flows of a project with typed parameters and an optional return value.
// Editing a block changes every place that calls it (like a component); there is no detach.

export const BLOCK_PARAM_TYPES = [...STATE_TYPES, "element"] as const;
export type BlockParamType = (typeof BLOCK_PARAM_TYPES)[number];

export interface BlockParam {
  id: string;
  name: string;
  /** A state type, or `element` for an element of the calling page. */
  type: BlockParamType;
  isList: boolean;
  /** The enum, data type or Supabase table for reference types. */
  ref: string;
  required: boolean;
}

export interface BlockReturn {
  type: StateType;
  isList: boolean;
  ref: string;
  /** The value returned when the block finishes, usually one {{ tag }}. */
  value: string;
}

export interface ActionBlock {
  id: string;
  name: string;
  description: string;
  params: BlockParam[];
  returns?: BlockReturn | undefined;
  nodes: FlowNode[];
}

const identifier = z
  .string()
  .min(1)
  .max(64)
  .regex(IDENTIFIER_PATTERN, "Use letters, digits and _, starting with a letter or _.");

export const blockParamSchema = z.object({
  id: z.string().min(1).max(64),
  name: identifier,
  type: z.enum(BLOCK_PARAM_TYPES),
  isList: z.boolean().default(false),
  ref: z.string().max(200).default(""),
  required: z.boolean().default(false)
});

export const actionBlockSchema: z.ZodType<ActionBlock, z.ZodTypeDef, unknown> = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).default(""),
  params: z
    .array(blockParamSchema)
    .max(30)
    .superRefine((params, ctx) => {
      const seen = new Set<string>();
      params.forEach((p, i) => {
        if (seen.has(p.name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "name"],
            message: "Parameter names must be unique."
          });
        }
        seen.add(p.name);
      });
    })
    .default([]),
  returns: z
    .object({
      type: z.enum(STATE_TYPES),
      isList: z.boolean().default(false),
      ref: z.string().max(200).default(""),
      value: z.string().max(2000).default("")
    })
    .optional(),
  nodes: z.array(flowNodeSchema).max(MAX_FLOW_NODES).default([])
});

/** Ids of the blocks a node list calls directly. */
export function calledBlocks(nodes: readonly FlowNode[]): Set<string> {
  const ids = new Set<string>();
  walkFlow(nodes, (node) => {
    if (node.kind === "block") ids.add(node.blockId);
  });
  return ids;
}

/** Ids of blocks that call themselves, directly or through other blocks. */
export function recursiveBlocks(blocks: readonly ActionBlock[]): Set<string> {
  const calls = new Map(blocks.map((b) => [b.id, calledBlocks(b.nodes)]));
  const out = new Set<string>();
  for (const block of blocks) {
    const seen = new Set<string>();
    const stack = [...(calls.get(block.id) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      if (next === block.id) {
        out.add(block.id);
        break;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(calls.get(next) ?? []));
    }
  }
  return out;
}
