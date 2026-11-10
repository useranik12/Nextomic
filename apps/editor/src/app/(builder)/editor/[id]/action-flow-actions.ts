"use server";

import {
  blankRuleContext,
  isOverlayType,
  overlayRanks,
  templateApplies,
  type Overlay,
  type OverlayTemplateType,
  type PageParam,
  type ElementNode,
  type SheetEntry,
  FLOW_OWNER_KINDS,
  saveBlockInputSchema,
  saveFlowsInputSchema,
  type FlowOwnerKind
} from "@nextomic/schema";
import { z } from "zod";
import {
  authorizeProject as authorize,
  failResult as fail,
  type ActionResult
} from "@/server/authorize";
import {
  deleteBlock,
  listBlocks,
  listFlows,
  saveBlock,
  saveFlows,
  type SaveBlockResult,
  type SaveFlowsResult,
  type StoredBlock,
  type StoredFlows
} from "@/server/action-flows";
import { getDb } from "@nextomic/db";
import { listPages } from "@/server/pages";
import { getDraftTemplates } from "@/server/templates";

const idSchema = z.string().min(1).max(64);
const kindSchema = z.enum(FLOW_OWNER_KINDS);

/** Every flow of a page or template, by element. */
export async function listFlowsAction(
  projectId: string,
  ownerKind: FlowOwnerKind,
  ownerId: string
): Promise<ActionResult<StoredFlows[]>> {
  try {
    await authorize(projectId);
    const owner = { kind: kindSchema.parse(ownerKind), id: idSchema.parse(ownerId) };
    return { data: await listFlows(projectId, owner), error: null };
  } catch (error) {
    return fail(error, "Could not load action flows.");
  }
}

/** Saves every flow of one element (the flow editor's Save). */
export async function saveFlowsAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<SaveFlowsResult>> {
  try {
    const userId = await authorize(projectId);
    return {
      data: await saveFlows(projectId, userId, saveFlowsInputSchema.parse(input)),
      error: null
    };
  } catch (error) {
    return fail(error, "Could not save the action flows.");
  }
}

export async function listBlocksAction(projectId: string): Promise<ActionResult<StoredBlock[]>> {
  try {
    await authorize(projectId);
    return { data: await listBlocks(getDb(), projectId), error: null };
  } catch (error) {
    return fail(error, "Could not load Action Blocks.");
  }
}

export async function saveBlockAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<SaveBlockResult>> {
  try {
    const userId = await authorize(projectId);
    return {
      data: await saveBlock(projectId, userId, saveBlockInputSchema.parse(input)),
      error: null
    };
  } catch (error) {
    return fail(error, "Could not save the Action Block.");
  }
}

export async function deleteBlockAction(
  projectId: string,
  blockId: string
): Promise<ActionResult<boolean>> {
  try {
    await authorize(projectId);
    return { data: await deleteBlock(projectId, idSchema.parse(blockId)), error: null };
  } catch (error) {
    return fail(error, "Could not delete the Action Block.");
  }
}

export interface TestOverlay {
  type: OverlayTemplateType;
  tree: ElementNode;
  params: PageParam[];
  overlay: Overlay;
  entry: SheetEntry;
  rank: number;
}

export interface TestContext {
  /** Page id to route, for Navigate To. */
  routes: Record<string, string>;
  /** Modal and bottom sheet templates that can show (saved draft set to Published, conditions that hold), by id. */
  overlays: Record<string, TestOverlay>;
}

/** What the flow editor's Test needs beyond the open page: page routes and modal and bottom sheet templates. */
export async function testContextAction(projectId: string): Promise<ActionResult<TestContext>> {
  try {
    await authorize(projectId);
    const [pages, templates] = await Promise.all([
      listPages(projectId),
      getDraftTemplates(projectId)
    ]);
    const ctx = blankRuleContext();
    const overlays: Record<string, TestOverlay> = {};
    for (const t of templates) {
      if (isOverlayType(t.type) && templateApplies(t, ctx)) {
        const ranks = overlayRanks(templates.filter((o) => o.type === t.type));
        overlays[t.id] = {
          type: t.type,
          tree: t.tree,
          params: t.settings.params,
          overlay: t.settings.overlay,
          entry: t.settings.entry,
          rank: ranks[t.id] ?? 0
        };
      }
    }
    return {
      data: { routes: Object.fromEntries(pages.map((p) => [p.id, p.route])), overlays },
      error: null
    };
  } catch (error) {
    return fail(error, "Could not prepare the test.");
  }
}
