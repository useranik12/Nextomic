import { pageIcons } from "@/server/icon-lookup";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  elementEditsSchema,
  overlayRanks,
  findRefreshQuery,
  refreshRequestSchema,
  resolveOverlay,
  type ElementQuery
} from "@nextomic/schema";
import { z } from "zod";
import { headersOf, previewMember, sameOrigin, visitorKey } from "@/server/runtime/site-request";
import {
  asVisitor,
  editorExecutor,
  pageLoopRows,
  projectWorkspaceId,
  siteExecutor,
  type Executor
} from "@/server/queries/run-query";
import { getProjectSettings } from "@/server/pages";
import { renewSession } from "@/server/runtime/auth-session";
import { createRateLimiter } from "@/server/rate-limit";
import {
  MAX_FRAGMENT_IDS,
  renderParts,
  renderOverlay,
  withClientState
} from "@/server/runtime/fragments";
import { draftFlows, liveFlows } from "@/server/runtime/page-runtime";
import { draftView, liveView } from "@/server/runtime/view-layout";
import { getDraftTemplates, getPublishedTemplates } from "@/server/templates";

// Server fragments for the action runtime (docs/dynamic-data-and-actions.md section 8): elements
// redrawn with the visitor's current app and page state, or the toast template filled with a
// message. The page, its templates and every server-known value (user, request, parameters) come
// from the server; the browser sends only the route, state values and element ids. Conditions on
// browser state cannot protect content (the visitor controls that state); server-known ones can.
// Preview requests need a signed-in project member. Pages Router: App Router cannot render to a string.

const PER_VISITOR = createRateLimiter(240, 60_000);
const PER_PROJECT = createRateLimiter(3000, 60_000);

const values = z.record(z.string().max(100), z.string().max(100_000)).default({});
const bodySchema = z.object({
  mode: z.enum(["live", "preview"]),
  route: z.string().startsWith("/").max(2000),
  search: z.string().max(4000).default(""),
  ids: z.array(z.string().min(1).max(64)).max(MAX_FRAGMENT_IDS).default([]),
  app: values,
  state: values,
  edits: elementEditsSchema.default({}),
  refreshes: refreshRequestSchema.default({}),
  overlay: z
    .object({
      templateId: z.string().min(1).max(64),
      params: z.record(z.string().max(64), z.string().max(5000)).default({})
    })
    .optional()
});

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader("cache-control", "no-store");
  const fail = (status: number, message: string) =>
    response.status(status).json({ error: message });
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return fail(405, "Use POST.");
  }
  const id = typeof request.query.id === "string" ? request.query.id : "";
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return fail(404, "Not found.");
  let headers = headersOf(request);
  // Same-origin only: pages call this from their own origin.
  if (!sameOrigin(headers)) return fail(403, "Cross-origin requests are not allowed.");
  if (!PER_VISITOR.take(`${id}:${visitorKey(headers)}`).ok || !PER_PROJECT.take(id).ok) {
    return fail(429, "Too many requests. Try again shortly.");
  }
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) return fail(400, "Invalid request.");
  const body = parsed.data;

  const member = body.mode === "preview" ? await previewMember(id, headers) : null;
  if (body.mode === "preview" && !member) return fail(404, "Not found.");
  // An expired visitor session is renewed here, where the cookie can be written.
  const renewed = await renewSession(
    body.mode,
    id,
    headers,
    (await getProjectSettings(id)).appAuth
  );
  headers = renewed.headers;
  if (renewed.setCookies.length > 0) response.setHeader("set-cookie", renewed.setCookies);
  const laid =
    body.mode === "live"
      ? await liveView(id, body.route, body.search, headers)
      : await draftView(id, body.route, body.search, headers, member);
  if (!laid) return fail(404, "Not found.");

  const dynamic = withClientState(laid.dynamic, body.app, body.state);
  // Loops inside a redrawn element run here, with the connector of this mode: the site's own in
  // its workspace, or the signed-in member's in the preview.
  let executor: Executor | null = null;
  const execute: Executor = async (row, request) => {
    if (!executor) {
      const workspaceId = await projectWorkspaceId(id);
      if (!workspaceId) throw new Error("Project not found.");
      executor = member
        ? editorExecutor({ userId: member.id, projectId: id, workspaceId })
        : siteExecutor(id, workspaceId);
    }
    return asVisitor(executor, laid.visitor?.accessToken)(row, request);
  };
  // Refresh Query: the query comes from the saved flow (published or draft), never the browser.
  let savedQuery: ((nodeId: string, loopId: string) => ElementQuery | null) | undefined;
  if (Object.keys(body.refreshes).length > 0) {
    const { flows, blocks } =
      body.mode === "live" && "pageFlows" in laid
        ? await liveFlows(id, laid.pageFlows, laid.templateIds)
        : "page" in laid
          ? await draftFlows(id, laid.page.id, laid.templateIds)
          : { flows: {}, blocks: [] };
    const lists = [
      ...Object.values(flows).flatMap((list) => list.map((flow) => flow.nodes)),
      ...blocks.map((block) => block.nodes)
    ];
    savedQuery = (nodeId, loopId) => findRefreshQuery(lists, nodeId, loopId);
  }
  const pageDrawn = await pageIcons(id, laid.settings.iconLibraries, [laid.tree]);
  const parts = await renderParts({
    icons: pageDrawn.icons,
    tree: laid.tree,
    dynamic,
    settings: laid.settings,
    ids: body.ids,
    edits: body.edits,
    refreshes: body.refreshes,
    savedQuery,
    loopRows: (node) => pageLoopRows({ projectId: id, tree: node, dynamic, execute })
  });
  let overlay: ReturnType<typeof renderOverlay> | null = null;
  if (body.overlay) {
    const templates =
      body.mode === "live" ? await getPublishedTemplates(id) : await getDraftTemplates(id);
    const named = templates.find((t) => t.id === body.overlay?.templateId);
    const template =
      named && (named.type === "modal" || named.type === "bottom-sheet")
        ? resolveOverlay(templates, laid.rules, named.id, named.type)
        : null;
    if (!template)
      return fail(
        409,
        "The modal or bottom sheet template is not published or its conditions do not match."
      );
    const ranks = overlayRanks(templates.filter((t) => t.type === template.type));
    const overlayDrawn = await pageIcons(id, laid.settings.iconLibraries, [template.tree]);
    overlay = renderOverlay({
      icons: overlayDrawn.icons,
      template,
      rank: ranks[template.id] ?? 0,
      dynamic,
      settings: laid.settings,
      params: body.overlay.params
    });
  }
  return response.status(200).json({ parts, overlay });
}

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
