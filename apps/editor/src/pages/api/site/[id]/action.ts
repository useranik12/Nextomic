import type { NextApiRequest, NextApiResponse } from "next";
import {
  actionRunRequestSchema,
  findServerAction,
  withActionValues,
  type NextomicUser
} from "@nextomic/schema";
import { ConnectorError } from "@nextomic/integrations";
import { z } from "zod";
import {
  editorExecutor,
  projectWorkspaceId,
  siteExecutor,
  type Executor
} from "@/server/queries/run-query";
import { createRateLimiter } from "@/server/rate-limit";
import { runServerAction } from "@/server/runtime/run-action";
import { draftFlows, liveFlows } from "@/server/runtime/page-runtime";
import { headersOf, previewMember, sameOrigin, visitorKey } from "@/server/runtime/site-request";
import { draftView, liveView } from "@/server/runtime/view-layout";

// Runs a server action of a built page (Supabase rows, Supabase RPC, API Data call) for the action
// runtime (docs/dynamic-data-and-actions.md section 8.8). The browser names the saved action node
// and sends only the filled values of its {{ tag }} fields; the table, columns, function and call
// come from the saved flow (published on the live site, draft in the preview), and the project's
// connector runs them with its own keys. Same-origin only and rate limited; the preview needs a
// signed-in project member. Pages Router, like the fragment endpoint.

const PER_VISITOR = createRateLimiter(60, 60_000);
const PER_PROJECT = createRateLimiter(1000, 60_000);

const bodySchema = actionRunRequestSchema.extend({
  route: z.string().startsWith("/").max(2000),
  search: z.string().max(4000).default("")
});

const STATUS: Record<string, number> = {
  invalid_request: 400,
  not_found: 404,
  upstream: 502
};

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
  const headers = headersOf(request);
  if (!sameOrigin(headers)) return fail(403, "Cross-origin requests are not allowed.");
  if (!PER_VISITOR.take(`${id}:${visitorKey(headers)}`).ok || !PER_PROJECT.take(id).ok) {
    return fail(429, "Too many requests. Try again shortly.");
  }
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) return fail(400, "Invalid request.");
  const body = parsed.data;

  const member: NextomicUser | null =
    body.mode === "preview" ? await previewMember(id, headers) : null;
  if (body.mode === "preview" && !member) return fail(404, "Not found.");
  const laid =
    body.mode === "live"
      ? await liveView(id, body.route, body.search, headers)
      : await draftView(id, body.route, body.search, headers, member);
  if (!laid) return fail(404, "Not found.");

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
  const saved = findServerAction(lists, body.node);
  if (!saved) return fail(404, "That action is not part of this page.");

  const workspaceId = await projectWorkspaceId(id);
  if (!workspaceId) return fail(404, "Not found.");
  const execute: Executor = member
    ? editorExecutor({ userId: member.id, projectId: id, workspaceId })
    : siteExecutor(id, workspaceId);
  try {
    const data = await runServerAction({
      projectId: id,
      def: saved.def,
      params: withActionValues(saved.def, saved.params, body.values),
      execute,
      userIp: visitorKey(headers)
    });
    return response.status(200).json({ data });
  } catch (error) {
    if (error instanceof ConnectorError) return fail(STATUS[error.code] ?? 400, error.message);
    return fail(500, "The action failed.");
  }
}

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
