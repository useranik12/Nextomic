import {
  actionBlockSchema,
  compactFlows,
  ownerFlowsSchema,
  walkElements,
  type ActionBlock,
  type ElementNode,
  type FlowOwnerKind,
  type FlowsByNode,
  type SaveBlockInput,
  type SaveFlowsInput,
  type TriggerFlow
} from "@nextomic/schema";
import { actionBlocks, actionFlows, getDb, pages, templates } from "@nextomic/db";
import { and, eq, notInArray } from "drizzle-orm";

// Action flows (one row per element of a page or template) and Action Blocks
// (docs/dynamic-data-and-actions.md section 8.3). Every query is scoped by project.

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Db | Tx;

export interface FlowOwnerRef {
  kind: FlowOwnerKind;
  id: string;
}

export interface StoredFlows {
  nodeId: string;
  flows: TriggerFlow[];
  version: number;
}

const ownerColumn = (kind: FlowOwnerKind) =>
  kind === "page" ? actionFlows.pageId : actionFlows.templateId;

const ownerWhere = (projectId: string, owner: FlowOwnerRef) =>
  and(eq(actionFlows.projectId, projectId), eq(ownerColumn(owner.kind), owner.id));

const parseFlows = (raw: unknown): TriggerFlow[] => ownerFlowsSchema.parse(raw);

export async function listFlows(projectId: string, owner: FlowOwnerRef): Promise<StoredFlows[]> {
  const rows = await getDb()
    .select({ nodeId: actionFlows.nodeId, flows: actionFlows.flows, version: actionFlows.version })
    .from(actionFlows)
    .where(ownerWhere(projectId, owner));
  return rows.map((row) => ({ ...row, flows: parseFlows(row.flows) }));
}

export async function flowsOf(
  db: Reader,
  projectId: string,
  owner: FlowOwnerRef
): Promise<FlowsByNode> {
  const rows = await db
    .select({ nodeId: actionFlows.nodeId, flows: actionFlows.flows })
    .from(actionFlows)
    .where(ownerWhere(projectId, owner));
  return compactFlows(Object.fromEntries(rows.map((r) => [r.nodeId, parseFlows(r.flows)])));
}

/** Every flow of a project, by page id and by template id (for publishing). */
export async function projectFlows(
  db: Reader,
  projectId: string
): Promise<{ pages: Map<string, FlowsByNode>; templates: Map<string, FlowsByNode> }> {
  const rows = await db.select().from(actionFlows).where(eq(actionFlows.projectId, projectId));
  const out = { pages: new Map<string, FlowsByNode>(), templates: new Map<string, FlowsByNode>() };
  for (const row of rows) {
    const flows = parseFlows(row.flows);
    if (flows.length === 0) continue;
    const [map, key] = row.pageId ? [out.pages, row.pageId] : [out.templates, row.templateId];
    if (!key) continue;
    map.set(key, { ...(map.get(key) ?? {}), [row.nodeId]: flows });
  }
  return out;
}

function nodeIds(tree: ElementNode): string[] {
  const ids: string[] = [];
  walkElements(tree, (node) => ids.push(node.id));
  return ids;
}

/**
 * After a page or template save: removes flows of elements no longer in the tree and writes the
 * flows of pasted or duplicated elements that have none yet.
 */
export async function syncFlowsWithTree(
  tx: Tx,
  projectId: string,
  owner: FlowOwnerRef,
  tree: ElementNode,
  copied: FlowsByNode = {}
): Promise<void> {
  const ids = nodeIds(tree);
  await tx
    .delete(actionFlows)
    .where(and(ownerWhere(projectId, owner), notInArray(actionFlows.nodeId, ids)));
  const live = new Set(ids);
  const rows = Object.entries(compactFlows(copied))
    .filter(([nodeId]) => live.has(nodeId))
    .map(([nodeId, flows]) => ({
      projectId,
      nodeId,
      flows,
      ...(owner.kind === "page" ? { pageId: owner.id } : { templateId: owner.id })
    }));
  if (rows.length > 0) await tx.insert(actionFlows).values(rows).onConflictDoNothing();
}

async function ownerExists(tx: Tx, projectId: string, owner: FlowOwnerRef): Promise<boolean> {
  const table = owner.kind === "page" ? pages : templates;
  const [row] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, owner.id), eq(table.projectId, projectId)))
    .limit(1);
  return row !== undefined;
}

/**
 * The flows of the elements that are in the tree. Flows are saved apart from the page draft, so an
 * element added and never saved (or removed again) can leave a record behind until the next page
 * save clears it; nothing published or run for a visitor may read such a record.
 */
export function flowsInTree(
  tree: ElementNode,
  flows: FlowsByNode | undefined
): FlowsByNode | undefined {
  if (!flows) return flows;
  const live = new Set(nodeIds(tree));
  return Object.fromEntries(Object.entries(flows).filter(([nodeId]) => live.has(nodeId)));
}

export type SaveFlowsResult =
  | { ok: true; version: number | null }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "conflict"; current: StoredFlows | null };

/** Saves every flow of one element; an empty list removes its record. */
export async function saveFlows(
  projectId: string,
  userId: string,
  input: SaveFlowsInput
): Promise<SaveFlowsResult> {
  const owner = { kind: input.ownerKind, id: input.ownerId };
  return getDb().transaction(async (tx) => {
    // The element may be new and not saved with the page yet: flows are saved on their own, and
    // the next page save drops the records of elements that never made it into the tree.
    if (!(await ownerExists(tx, projectId, owner))) return { ok: false, reason: "not-found" };
    const where = and(ownerWhere(projectId, owner), eq(actionFlows.nodeId, input.nodeId));
    const [row] = await tx.select().from(actionFlows).where(where).for("update").limit(1);
    if ((row?.version ?? null) !== input.baseVersion) {
      const current = row
        ? { nodeId: row.nodeId, flows: parseFlows(row.flows), version: row.version }
        : null;
      return { ok: false, reason: "conflict", current };
    }
    if (input.flows.length === 0) {
      if (row) await tx.delete(actionFlows).where(eq(actionFlows.id, row.id));
      return { ok: true, version: null };
    }
    if (row) {
      const version = row.version + 1;
      await tx
        .update(actionFlows)
        .set({ flows: input.flows, version, updatedBy: userId, updatedAt: new Date() })
        .where(eq(actionFlows.id, row.id));
      return { ok: true, version };
    }
    await tx.insert(actionFlows).values({
      projectId,
      nodeId: input.nodeId,
      flows: input.flows,
      updatedBy: userId,
      ...(owner.kind === "page" ? { pageId: owner.id } : { templateId: owner.id })
    });
    return { ok: true, version: 1 };
  });
}

// ---------------------------------------------------------------- Action Blocks

export interface StoredBlock {
  block: ActionBlock;
  version: number;
}

export async function listBlocks(db: Reader, projectId: string): Promise<StoredBlock[]> {
  const rows = await db
    .select({ block: actionBlocks.block, version: actionBlocks.version })
    .from(actionBlocks)
    .where(eq(actionBlocks.projectId, projectId))
    .orderBy(actionBlocks.createdAt);
  return rows.map((row) => ({ block: actionBlockSchema.parse(row.block), version: row.version }));
}

export const projectBlocks = async (db: Reader, projectId: string): Promise<ActionBlock[]> =>
  (await listBlocks(db, projectId)).map((b) => b.block);

export type SaveBlockResult =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict"; current: StoredBlock | null }
  | { ok: false; reason: "name-taken" };

export async function saveBlock(
  projectId: string,
  userId: string,
  input: SaveBlockInput
): Promise<SaveBlockResult> {
  const { block } = input;
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(actionBlocks)
      .where(eq(actionBlocks.projectId, projectId))
      .for("update");
    const row = rows.find((r) => r.id === block.id);
    if ((row?.version ?? null) !== input.baseVersion) {
      const current = row
        ? { block: actionBlockSchema.parse(row.block), version: row.version }
        : null;
      return { ok: false, reason: "conflict", current };
    }
    const lower = block.name.toLowerCase();
    if (rows.some((r) => r.id !== block.id && r.block.name.toLowerCase() === lower)) {
      return { ok: false, reason: "name-taken" };
    }
    if (row) {
      const version = row.version + 1;
      await tx
        .update(actionBlocks)
        .set({ block, version, updatedBy: userId, updatedAt: new Date() })
        .where(and(eq(actionBlocks.id, block.id), eq(actionBlocks.projectId, projectId)));
      return { ok: true, version };
    }
    await tx.insert(actionBlocks).values({ id: block.id, projectId, block, updatedBy: userId });
    return { ok: true, version: 1 };
  });
}

export async function deleteBlock(projectId: string, blockId: string): Promise<boolean> {
  const removed = await getDb()
    .delete(actionBlocks)
    .where(and(eq(actionBlocks.id, blockId), eq(actionBlocks.projectId, projectId)))
    .returning({ id: actionBlocks.id });
  return removed.length > 0;
}

/** Copies every flow of a page or template to another one (duplicate page or template). */
export async function copyOwnerFlows(
  projectId: string,
  from: FlowOwnerRef,
  to: FlowOwnerRef
): Promise<void> {
  const db = getDb();
  const flows = await flowsOf(db, projectId, from);
  const rows = Object.entries(flows).map(([nodeId, list]) => ({
    projectId,
    nodeId,
    flows: list,
    ...(to.kind === "page" ? { pageId: to.id } : { templateId: to.id })
  }));
  if (rows.length > 0) await db.insert(actionFlows).values(rows).onConflictDoNothing();
}
