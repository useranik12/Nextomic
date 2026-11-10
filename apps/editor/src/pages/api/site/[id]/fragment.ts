import type { NextApiRequest, NextApiResponse } from "next";
import type { NextomicUser } from "@nextomic/schema";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { nextomicUserOf } from "@/server/nextomic-user";
import { createRateLimiter } from "@/server/rate-limit";
import {
  MAX_FRAGMENT_IDS,
  renderParts,
  renderToast,
  withClientState
} from "@/server/runtime/fragments";
import { draftView, liveView } from "@/server/runtime/view-layout";

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
  toast: z
    .object({
      title: z.string().max(500),
      message: z.string().max(5000),
      type: z.string().max(20)
    })
    .optional()
});

function headersOf(request: NextApiRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  return headers;
}

function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const visitorKey = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";

/** The builder account of a preview request when it is a signed-in member of the project. */
async function previewMember(projectId: string, headers: Headers): Promise<NextomicUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  try {
    await requireProjectAccess(session.user.id, projectId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return null;
    throw error;
  }
  return nextomicUserOf(session.user);
}

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
  const laid =
    body.mode === "live"
      ? await liveView(id, body.route, body.search, headers)
      : await draftView(id, body.route, body.search, headers, member);
  if (!laid) return fail(404, "Not found.");

  const dynamic = withClientState(laid.dynamic, body.app, body.state);
  const parts = renderParts({ tree: laid.tree, dynamic, settings: laid.settings, ids: body.ids });
  let toast: { html: string; css: string } | null = null;
  if (body.toast) {
    if (!laid.toast) return fail(409, "No toast template is published.");
    toast = renderToast({
      template: laid.toast.tree,
      dynamic,
      settings: laid.settings,
      toast: body.toast
    });
  }
  return response.status(200).json({ parts, toast });
}

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
