import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { AuthError, ConnectorError } from "@nextomic/integrations";
import {
  fileAccepted,
  findUploadAction,
  QueryInputError,
  cleanStoragePath,
  uploadTarget,
  withActionValues,
  type NextomicUser
} from "@nextomic/schema";
import { getProjectSettings } from "@/server/pages";
import {
  asVisitor,
  editorExecutor,
  projectConnector,
  projectWorkspaceId,
  siteExecutor,
  type Executor
} from "@/server/queries/run-query";
import { createRateLimiter } from "@/server/rate-limit";
import { renewSession } from "@/server/runtime/auth-session";
import { storedFileName } from "@/server/runtime/stored-file-name";
import { draftFlows, liveFlows } from "@/server/runtime/page-runtime";
import { headersOf, previewMember, sameOrigin, visitorKey } from "@/server/runtime/site-request";
import { draftView, liveView } from "@/server/runtime/view-layout";

// Stores one file a visitor picked in a bucket of the project's Supabase (Pick File(s) set to
// upload, Upload File; docs/dynamic-data-and-actions.md section 8.9). The body is the file's bytes.
// The browser names the saved action node and sends only the filled values of its {{ tag }} fields;
// the bucket, folder, size limit and accepted types come from the saved flow. The file goes in as
// the signed-in visitor, so the bucket's policies decide who may write. Same-origin, rate limited,
// and the preview needs a signed-in project member.

const PER_VISITOR = createRateLimiter(30, 60_000);
const PER_PROJECT = createRateLimiter(300, 60_000);

const queryUploadSchema = z.object({
  mode: z.enum(["live", "preview"]),
  node: z.string().min(1).max(64),
  name: z.string().min(1).max(300),
  route: z.string().startsWith("/").max(2000),
  search: z.string().max(4000).default("")
});

const valuesSchema = z.array(z.string().max(5000)).max(50);

async function readBody(request: NextApiRequest, limit: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
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
  let headers = headersOf(request);
  if (!sameOrigin(headers)) return fail(403, "Cross-origin requests are not allowed.");
  if (!PER_VISITOR.take(`${id}:${visitorKey(headers)}`).ok || !PER_PROJECT.take(id).ok)
    return fail(429, "Too many requests. Try again shortly.");
  const query = queryUploadSchema.safeParse({
    mode: request.query.mode,
    node: request.query.node,
    name: request.query.name,
    route: request.query.route,
    search: request.query.search ?? ""
  });
  if (!query.success) return fail(400, "Invalid request.");
  const info = query.data;
  let values: string[] = [];
  try {
    const raw = headers.get("x-nx-values");
    values = valuesSchema.parse(raw ? JSON.parse(decodeURIComponent(raw)) : []);
  } catch {
    return fail(400, "Invalid request.");
  }
  const type =
    (headers.get("content-type") ?? "").split(";")[0]?.trim() || "application/octet-stream";

  const member: NextomicUser | null =
    info.mode === "preview" ? await previewMember(id, headers) : null;
  if (info.mode === "preview" && !member) return fail(404, "Not found.");
  const renewed = await renewSession(
    info.mode,
    id,
    headers,
    (await getProjectSettings(id)).appAuth
  );
  headers = renewed.headers;
  if (renewed.setCookies.length > 0) response.setHeader("set-cookie", renewed.setCookies);
  const laid =
    info.mode === "live"
      ? await liveView(id, info.route, info.search, headers)
      : await draftView(id, info.route, info.search, headers, member);
  if (!laid) return fail(404, "Not found.");
  const { flows, blocks } =
    info.mode === "live" && "pageFlows" in laid
      ? await liveFlows(id, laid.pageFlows, laid.templateIds)
      : "page" in laid
        ? await draftFlows(id, laid.page.id, laid.templateIds)
        : { flows: {}, blocks: [] };
  const lists = [
    ...Object.values(flows).flatMap((list) => list.map((flow) => flow.nodes)),
    ...blocks.map((block) => block.nodes)
  ];
  const saved = findUploadAction(lists, info.node);
  if (!saved) return fail(404, "That action is not part of this page.");

  try {
    const target = uploadTarget(withActionValues(saved.def, saved.params, values));
    const name = storedFileName(info.name);
    if (!fileAccepted(target.accept, name, type))
      return fail(415, "This kind of file is not accepted here.");
    const declared = Number(request.headers["content-length"]);
    if (Number.isFinite(declared) && declared > target.maxBytes)
      return fail(413, "The file is too large.");
    const bytes = await readBody(request, target.maxBytes);
    if (!bytes) return fail(413, "The file is too large.");
    if (bytes.length === 0) return fail(400, "The file is empty.");

    const workspaceId = await projectWorkspaceId(id);
    const row = await projectConnector(id, "supabase");
    if (!workspaceId || !row) return fail(404, "Connect Supabase first.");
    const execute: Executor = asVisitor(
      member
        ? editorExecutor({ userId: member.id, projectId: id, workspaceId })
        : siteExecutor(id, workspaceId),
      laid.visitor?.accessToken
    );
    const path = cleanStoragePath(target.folder ? `${target.folder}/${name}` : name);
    await execute(row, {
      resourceId: `bucket:${target.bucket}`,
      params: {
        op: "storage.upload",
        path,
        data: bytes.toString("base64"),
        contentType: type,
        upsert: target.upsert
      }
    });
    return response
      .status(200)
      .json({ data: { name, size: bytes.length, type, bucket: target.bucket, path } });
  } catch (error) {
    if (error instanceof QueryInputError) return fail(400, error.message);
    if (error instanceof AuthError) return fail(401, error.message);
    if (error instanceof ConnectorError) {
      // Storage's own answer decides: a refused write is 403 (policies), not a gateway fault.
      const upstream = error.status;
      const status =
        error.code === "invalid_request"
          ? 400
          : upstream === 401 || upstream === 403
            ? 403
            : upstream === 404 || upstream === 409 || upstream === 413
              ? upstream
              : 502;
      return fail(status, error.message);
    }
     
    console.error("[upload]", error);
    return fail(500, "The upload failed.");
  }
}

// The body is the file itself: read it here, with the limit of the saved action.
export const config = { api: { bodyParser: false } };
