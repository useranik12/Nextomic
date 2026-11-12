"use client";

import {
  browserPersistEnv,
  startActionRuntime,
  type FragmentRequest,
  type FragmentResponse,
  type RuntimePayload
} from "@nextomic/runtime";
import { useEffect } from "react";
import { overlaySchema, sheetEntrySchema } from "@nextomic/schema";
import { z } from "zod";

// Client side of action flows on /site and /preview (docs/dynamic-data-and-actions.md section 8).
// The server sends the flows, blocks and state this page needs; redraws, modals and bottom sheets come from the
// fragment endpoint as rendered HTML.

const responseSchema = z.object({
  parts: z.array(z.object({ id: z.string(), html: z.string(), css: z.string() })),
  overlay: z
    .object({
      templateId: z.string(),
      type: z.enum(["modal", "bottom-sheet"]),
      html: z.string(),
      css: z.string(),
      overlay: overlaySchema,
      entry: sheetEntrySchema,
      rank: z.number().int().min(0)
    })
    .nullable()
});
const errorSchema = z.object({ error: z.string() });

/** The page URL of a route on this site: the live site, or the owner preview. */
function hrefFor(payload: RuntimePayload, route: string, query: URLSearchParams): string {
  const id = encodeURIComponent(payload.projectId);
  if (payload.mode === "live") {
    const search = query.toString();
    return `/site/${id}${route === "/" ? "" : route}${search ? `?${search}` : ""}`;
  }
  const params = new URLSearchParams(query);
  params.set("path", route);
  return `/preview/${id}?${params.toString()}`;
}

async function fetchFragments(
  payload: RuntimePayload,
  request: FragmentRequest
): Promise<FragmentResponse> {
  const response = await fetch(`/api/site/${encodeURIComponent(payload.projectId)}/fragment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: payload.mode,
      route: payload.route,
      search: payload.search,
      ...request
    })
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : `Request failed (${response.status}).`);
  }
  return responseSchema.parse(body);
}

const answerSchema = z.object({ data: z.unknown() });

async function runServerAction(
  payload: RuntimePayload,
  request: { node: string; values: string[] }
): Promise<unknown> {
  const response = await fetch(`/api/site/${encodeURIComponent(payload.projectId)}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: payload.mode,
      route: payload.route,
      search: payload.search,
      ...request
    })
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : `Request failed (${response.status}).`);
  }
  return answerSchema.parse(body).data;
}

export function ActionRuntime({ payload }: { payload: RuntimePayload }) {
  useEffect(() => {
    const persist = browserPersistEnv(
      payload.mode === "live" ? payload.projectId : `preview-${payload.projectId}`
    );
    const runtime = startActionRuntime(payload, {
      persist,
      fetchFragments: (request) => fetchFragments(payload, request),
      hrefFor: (route, query) => hrefFor(payload, route, query),
      runServerAction: (request) => runServerAction(payload, request),
      // A failed flow is reported to the page owner in preview; visitors of the live site see nothing.
      onError: (message) => {
        if (payload.mode === "preview") console.error(`[Nextomic actions] ${message}`);
      }
    });
    return runtime.stop;
  }, [payload]);
  return null;
}
