import { z } from "zod";
import { actionBlockSchema } from "./blocks";
import { ownerFlowsSchema, type TriggerFlow } from "./flow";

// How flows and Action Blocks are saved (docs/dynamic-data-and-actions.md section 8.3). Flows are
// stored apart from the page tree, one record per element of a page or template; the modal saves
// them on its own, independent of the page draft.

export const FLOW_OWNER_KINDS = ["page", "template"] as const;
export type FlowOwnerKind = (typeof FLOW_OWNER_KINDS)[number];

const id = z.string().min(1).max(64);

/** Flows by element id. */
export type FlowsByNode = Record<string, TriggerFlow[]>;

export const flowsByNodeSchema = z
  .record(id, ownerFlowsSchema)
  .refine((map) => Object.keys(map).length <= 500, "At most 500 elements with flows.");

export const saveFlowsInputSchema = z.object({
  ownerKind: z.enum(FLOW_OWNER_KINDS),
  ownerId: id,
  nodeId: id,
  /** Version the editor loaded; null when the element had no flows yet. */
  baseVersion: z.number().int().min(1).nullable(),
  /** Every flow of the element; an empty list removes the record. */
  flows: ownerFlowsSchema
});
export type SaveFlowsInput = z.infer<typeof saveFlowsInputSchema>;

export const saveBlockInputSchema = z.object({
  /** Version the editor loaded; null for a new block. */
  baseVersion: z.number().int().min(1).nullable(),
  block: actionBlockSchema
});
export type SaveBlockInput = z.infer<typeof saveBlockInputSchema>;

/** Drops elements without flows, so snapshots compare equal however they were saved. */
export function compactFlows(map: FlowsByNode): FlowsByNode {
  return Object.fromEntries(Object.entries(map).filter(([, flows]) => flows.length > 0));
}
