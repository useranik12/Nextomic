import { renderLoopCopies } from "@nextomic/renderer";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getPublishedView, publishedLayout } from "@/server/published-layout";
import { loopPage, projectWorkspaceId, siteExecutor } from "@/server/queries/run-query";
import { createRateLimiter } from "@/server/rate-limit";

// Public endpoint of published sites (docs/dynamic-data-and-actions.md section 3): the next page
// of an infinite scroll loop, or a loop's first page again after a realtime change. The browser
// sends only the page route, its query string, the loop run's key and an offset; the server finds
// the loop in the published page and fills every template itself, so a visitor cannot change what
// a query asks for. The answer is rendered HTML of the new copies, like the server render.
// It is a Pages Router API route because App Router routes cannot render React to a string.

const PER_VISITOR = createRateLimiter(120, 60_000);
const PER_PROJECT = createRateLimiter(1200, 60_000);

const bodySchema = z.object({
  route: z.string().startsWith("/").max(2000),
  search: z.string().max(4000).default(""),
  key: z.string().min(1).max(4000),
  offset: z.number().int().min(0).max(1_000_000)
});

/** The request headers as a Headers object (for the page's request facts). */
function headersOf(request: NextApiRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  return headers;
}

function visitorKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
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
  const visitor = PER_VISITOR.take(`${id}:${visitorKey(headers)}`);
  const project = PER_PROJECT.take(id);
  if (!visitor.ok || !project.ok) return fail(429, "Too many requests. Try again shortly.");

  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) return fail(400, "Invalid request.");
  const body = parsed.data;

  const view = await getPublishedView(id, body.route === "/" ? null : body.route);
  const workspaceId = view ? await projectWorkspaceId(id) : null;
  if (!view || !workspaceId) return fail(404, "Not found.");

  const values: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body.search)) values[key] ??= value;
  const { tree, dynamic } = await publishedLayout(id, view, values, headers);

  try {
    const page = await loopPage({
      projectId: id,
      tree,
      dynamic,
      execute: siteExecutor(id, workspaceId),
      key: body.key,
      offset: body.offset
    });
    if (!page) return fail(404, "Not found.");
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        renderLoopCopies(
          page.node,
          {
            breakpoints: view.settings.breakpoints,
            dynamic,
            loopRows: page.loopRows,
            loopMarkers: true
          },
          page.start
        )
      )
    );
    return response.status(200).json({ html, count: page.count, hasMore: page.hasMore });
  } catch {
    return fail(502, "The query could not run.");
  }
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
