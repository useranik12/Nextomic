"use client";

import {
  browserPersistEnv,
  ServerActionError,
  startActionRuntime,
  type FragmentRequest,
  type FragmentResponse,
  type RuntimePayload,
  type ServerActionResult,
  type UploadedFile
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

const answerSchema = z.object({
  data: z.unknown(),
  go: z.string().url().optional(),
  after: z.object({ redirect: z.string().nullable() }).optional()
});
const actionErrorSchema = z.object({ error: z.string(), code: z.string().optional() });

async function runServerAction(
  payload: RuntimePayload,
  request: { node: string; values: string[] }
): Promise<ServerActionResult> {
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
    const parsed = actionErrorSchema.safeParse(body);
    const message = parsed.success ? parsed.data.error : `Request failed (${response.status}).`;
    throw parsed.success && parsed.data.code
      ? new ServerActionError(message, parsed.data.code)
      : new Error(message);
  }
  const answer = answerSchema.parse(body);
  return { data: answer.data ?? null, go: answer.go, after: answer.after };
}

const uploadAnswerSchema = z.object({
  data: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    bucket: z.string(),
    path: z.string()
  })
});

async function uploadFile(
  payload: RuntimePayload,
  request: { node: string; values: string[]; file: File }
): Promise<UploadedFile> {
  const query = new URLSearchParams({
    mode: payload.mode,
    node: request.node,
    name: request.file.name,
    route: payload.route,
    search: payload.search
  });
  const response = await fetch(
    `/api/site/${encodeURIComponent(payload.projectId)}/upload?${query.toString()}`,
    {
      method: "POST",
      headers: {
        "content-type": request.file.type || "application/octet-stream",
        "x-nx-values": encodeURIComponent(JSON.stringify(request.values))
      },
      body: request.file
    }
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = actionErrorSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : `Upload failed (${response.status}).`);
  }
  return uploadAnswerSchema.parse(body).data;
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
      uploadFile: (request) => uploadFile(payload, request),
      // A failed flow is reported to the page owner in preview; visitors of the live site see nothing.
      onError: (message) => {
        if (payload.mode === "preview") console.error(`[Nextomic actions] ${message}`);
      }
    });
    return runtime.stop;
  }, [payload]);
  return null;
}
