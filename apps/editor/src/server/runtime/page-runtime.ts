import {
  calledBlocks,
  stateDependencies,
  walkFlow,
  type ActionBlock,
  type DynamicContext,
  type ElementNode,
  isOverlayType,
  type FlowsByNode,
  type ProjectSettings
} from "@nextomic/schema";
import { getDb, projects } from "@nextomic/db";
import { eq } from "drizzle-orm";
import type { RuntimePayload } from "@nextomic/runtime";
import { loopFreeIds } from "@/server/runtime/loop-free";
import { flowsOf, listBlocks } from "@/server/action-flows";
import { listPages } from "@/server/pages";
import type { PublishedView } from "@/server/publish";
import { getDraftTemplates, getPublishedTemplates } from "@/server/templates";

// What a built page's action runtime receives (docs/dynamic-data-and-actions.md section 8): the
// flows of the page and of the header and footer shown, the Action Blocks they call, which
// elements read which state, and the page's dynamic context without the raw access token.

/** Only blocks the flows call (and blocks those call), so unused blocks never reach the page. */
function usedBlocks(flows: FlowsByNode, all: readonly ActionBlock[]): ActionBlock[] {
  const wanted = new Set<string>();
  const queue = Object.values(flows).flatMap((list) =>
    list.flatMap((flow) => [...calledBlocks(flow.nodes)])
  );
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (wanted.has(id)) continue;
    wanted.add(id);
    const block = all.find((b) => b.id === id);
    if (block) queue.push(...calledBlocks(block.nodes));
  }
  return all.filter((b) => wanted.has(b.id));
}

const hasNodes = (flows: FlowsByNode) =>
  Object.values(flows).some((list) => list.some((f) => !f.disabled && f.nodes.length > 0));

/** Every action type in the flows (for the payload check and tests). */
export function actionTypes(flows: FlowsByNode): string[] {
  const types = new Set<string>();
  for (const list of Object.values(flows)) {
    for (const flow of list) walkFlow(flow.nodes, (n) => n.kind === "action" && types.add(n.type));
  }
  return [...types];
}

interface PayloadInput {
  projectId: string;
  mode: "live" | "preview";
  route: string;
  search: string;
  tree: ElementNode;
  dynamic: DynamicContext;
  settings: ProjectSettings;
  flows: FlowsByNode;
  blocks: readonly ActionBlock[];
  rootIds: string[];
  routes: Record<string, string>;
}

/** Which state each element reads; elements inside query loops redraw with their loop. */
function loopFreeDeps(tree: ElementNode): Record<string, string[]> {
  const free = loopFreeIds(tree);
  return Object.fromEntries(Object.entries(stateDependencies(tree)).filter(([id]) => free.has(id)));
}

/** The runtime payload, or null when the page has no flows (no runtime is shipped then). */
export function runtimePayload(input: PayloadInput): RuntimePayload | null {
  if (!hasNodes(input.flows)) return null;
  const user = input.dynamic.user ? { ...input.dynamic.user, accessToken: "" } : null;
  return {
    projectId: input.projectId,
    mode: input.mode,
    route: input.route,
    search: input.search,
    flows: input.flows,
    blocks: usedBlocks(input.flows, input.blocks),
    deps: loopFreeDeps(input.tree),
    rootIds: input.rootIds,
    dynamic: { ...input.dynamic, user, exposeAccessToken: false },
    appState: input.settings.appState,
    routes: input.routes,
    // The page sets these once its theme is resolved (themeSwitching).
    themes: []
  };
}

/** What a page render passes in: the laid-out page (see layoutForPage). */
interface LaidPage {
  tree: ElementNode;
  dynamic: DynamicContext;
  templateIds: string[];
  rootIds: string[];
}

/** The flows a page runs and every Action Block of the project. */
export interface PageFlows {
  flows: FlowsByNode;
  blocks: ActionBlock[];
}

/**
 * The published flows of a live page (the page, its header and footer, and every modal and bottom
 * sheet, which actions can open anywhere) and the published Action Blocks.
 */
export async function liveFlows(
  projectId: string,
  pageFlows: FlowsByNode | undefined,
  templateIds: readonly string[]
): Promise<PageFlows> {
  const flows: FlowsByNode = { ...(pageFlows ?? {}) };
  const templates = await getPublishedTemplates(projectId);
  for (const t of templates)
    if (templateIds.includes(t.id) || isOverlayType(t.type)) Object.assign(flows, t.flows);
  if (!hasNodes(flows)) return { flows, blocks: [] };
  const [row] = await getDb()
    .select({ blocks: projects.publishedActionBlocks })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return { flows, blocks: row?.blocks ?? [] };
}

/** The saved (draft) flows of a page for the owner preview, with the draft Action Blocks. */
export async function draftFlows(
  projectId: string,
  pageId: string,
  templateIds: readonly string[]
): Promise<PageFlows> {
  const db = getDb();
  const flows: FlowsByNode = { ...(await flowsOf(db, projectId, { kind: "page", id: pageId })) };
  const overlayIds = (await getDraftTemplates(projectId))
    .filter((t) => isOverlayType(t.type))
    .map((t) => t.id);
  for (const id of new Set([...templateIds, ...overlayIds])) {
    Object.assign(flows, await flowsOf(db, projectId, { kind: "template", id }));
  }
  if (!hasNodes(flows)) return { flows, blocks: [] };
  const blocks = await listBlocks(db, projectId);
  return { flows, blocks: blocks.map((b) => b.block) };
}

/** The payload of a live page; flows and blocks come from the published snapshot. */
export async function livePayload(
  projectId: string,
  view: PublishedView,
  laid: LaidPage,
  search: string
): Promise<RuntimePayload | null> {
  const { flows, blocks } = await liveFlows(projectId, view.page.flows, laid.templateIds);
  if (!hasNodes(flows)) return null;
  return runtimePayload({
    ...laid,
    projectId,
    mode: "live",
    route: view.page.route,
    search,
    settings: view.settings,
    flows,
    blocks,
    routes: view.routes
  });
}

/** The payload of the owner preview: saved (draft) flows and blocks. */
export async function previewPayload(
  projectId: string,
  page: { id: string; route: string },
  settings: ProjectSettings,
  laid: LaidPage,
  search: string
): Promise<RuntimePayload | null> {
  const { flows, blocks } = await draftFlows(projectId, page.id, laid.templateIds);
  if (!hasNodes(flows)) return null;
  const pages = await listPages(projectId);
  return runtimePayload({
    ...laid,
    projectId,
    mode: "preview",
    route: page.route,
    search,
    settings,
    flows,
    blocks,
    routes: Object.fromEntries(pages.map((p) => [p.id, p.route]))
  });
}
