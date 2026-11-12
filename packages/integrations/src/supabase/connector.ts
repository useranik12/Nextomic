import type { SupabaseBucket, SupabaseFunction, SupabaseTable } from "@nextomic/schema";
import { z } from "zod";
import { ConnectorError } from "../errors";
import { registerConnector } from "../registry";
import { safeFetch, type SafeResponse } from "../safe-fetch";
import type { Connector, ConnectorContext, ExecuteResult, Resource, TestResult } from "../types";
import { AUTH_RESOURCE_ID, runAuth } from "./auth";
import { openApiSchema, readFunctions, readTables } from "./openapi";
import { parseResourceId, supabaseRequestSchema, TABLE_METHODS, tableQuery } from "./query";

// The Supabase connector. It uses only the anon (publishable) key, as built apps do: what it can
// read and write is exactly what the project's grants and RLS give the anon role.

export const supabaseConfigSchema = z.object({
  projectUrl: z
    .string()
    .trim()
    .url("Enter the Supabase URL, e.g. https://xyz.supabase.co.")
    .refine((v) => /^https?:\/\//i.test(v), "The Supabase URL starts with https://.")
    .transform((v) => v.replace(/\/+$/, "")),
  schema: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use a schema name such as public.")
    .max(63)
    .default("public"),
  auth: z
    .object({
      google: z
        .object({
          enabled: z.boolean().default(false),
          webClientId: z.string().trim().max(300).default("")
        })
        .default({})
    })
    .default({})
});

export const supabaseSecretsSchema = z.object({
  anonKey: z.string().trim().min(20, "Paste the anon or publishable key.").max(5000)
});

export type SupabaseConfig = z.infer<typeof supabaseConfigSchema>;
export type SupabaseSecrets = z.infer<typeof supabaseSecretsSchema>;

/** Top-level entries counted per bucket when the schema is fetched; more shows as "1000+". */
export const BUCKET_COUNT_CAP = 1000;

function headers(cfg: SupabaseConfig, secrets: SupabaseSecrets, write = false, userToken = "") {
  const out: Record<string, string> = {
    apikey: secrets.anonKey,
    // A signed-in visitor's own token makes RLS see them; the apikey stays the anon key.
    authorization: `Bearer ${userToken || secrets.anonKey}`,
    accept: "application/json"
  };
  if (cfg.schema !== "public") {
    out["accept-profile"] = cfg.schema;
    if (write) out["content-profile"] = cfg.schema;
  }
  return out;
}

function parseJson(response: SafeResponse): unknown {
  if (response.body.length === 0) return null;
  try {
    return JSON.parse(response.body.toString("utf8"));
  } catch {
    throw new ConnectorError("upstream", "Supabase sent a reply that is not JSON.", {
      status: response.status
    });
  }
}

/** Supabase's own error text (PostgREST `message`, Storage `message`/`error`), never a body dump. */
function upstreamError(response: SafeResponse, fallback: string): ConnectorError {
  let message = fallback;
  try {
    const body = JSON.parse(response.body.toString("utf8")) as Record<string, unknown>;
    const text = body.message ?? body.error ?? body.msg;
    if (typeof text === "string" && text.length > 0) message = text.slice(0, 300);
  } catch {
    // Not JSON: keep the fallback.
  }
  if (response.status === 401 || response.status === 403)
    message = `${message} Check the anon key and the table's grants and RLS policies.`;
  return new ConnectorError("upstream", message, { status: response.status });
}

async function call(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  ctx: ConnectorContext,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string; userToken?: string } = {}
): Promise<SafeResponse> {
  const write = init.method !== undefined && init.method !== "GET";
  const requestHeaders = headers(cfg, secrets, write, init.userToken);
  if (init.body !== undefined) requestHeaders["content-type"] = "application/json";
  if (init.prefer) requestHeaders.prefer = init.prefer;
  return safeFetch(`${cfg.projectUrl}${path}`, {
    method: init.method ?? "GET",
    headers: requestHeaders,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    allowPrivateHosts: ctx.allowPrivateHosts,
    signal: ctx.signal
  });
}

async function readOpenApi(cfg: SupabaseConfig, secrets: SupabaseSecrets, ctx: ConnectorContext) {
  const response = await call(cfg, secrets, ctx, "/rest/v1/");
  if (response.status !== 200)
    throw upstreamError(response, "Supabase refused the schema request.");
  const doc = openApiSchema.safeParse(parseJson(response));
  if (!doc.success || !doc.data.swagger)
    throw new ConnectorError(
      "upstream",
      "This address did not answer like a Supabase REST API. Check the URL."
    );
  return { doc: doc.data, latencyMs: response.latencyMs };
}

const bucketListSchema = z.array(
  z.object({ name: z.string(), public: z.boolean().default(false) })
);

/** Buckets the anon key can see (RLS on storage.buckets decides), with top-level counts. */
async function readBuckets(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  ctx: ConnectorContext
): Promise<SupabaseBucket[]> {
  const response = await call(cfg, secrets, ctx, "/storage/v1/bucket");
  // Storage may be disabled or refuse the anon role; the schema fetch still succeeds.
  if (response.status !== 200) return [];
  const list = bucketListSchema.safeParse(parseJson(response));
  if (!list.success) return [];
  const buckets: SupabaseBucket[] = [];
  for (const bucket of list.data.slice(0, 500)) {
    const entries = await listObjects(cfg, secrets, ctx, bucket.name, "", BUCKET_COUNT_CAP).catch(
      () => []
    );
    buckets.push({
      name: bucket.name,
      public: bucket.public,
      objectCount: entries.length,
      countCapped: entries.length >= BUCKET_COUNT_CAP
    });
  }
  return buckets;
}

const objectSchema = z
  .object({
    name: z.string(),
    id: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    metadata: z
      .object({ size: z.number().optional(), mimetype: z.string().optional() })
      .passthrough()
      .nullable()
      .optional()
  })
  .passthrough();

export interface StorageEntry {
  name: string;
  /** Folders have no id in the Storage API listing. */
  folder: boolean;
  size: number | null;
  mimeType: string | null;
  updatedAt: string | null;
}

async function listObjects(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  ctx: ConnectorContext,
  bucket: string,
  prefix: string,
  limit: number
): Promise<StorageEntry[]> {
  const response = await call(
    cfg,
    secrets,
    ctx,
    `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
    {
      method: "POST",
      body: { prefix, limit, offset: 0, sortBy: { column: "name", order: "asc" } }
    }
  );
  if (response.status !== 200) throw upstreamError(response, "Could not list the bucket.");
  const parsed = z.array(objectSchema).safeParse(parseJson(response));
  if (!parsed.success) throw new ConnectorError("upstream", "Supabase sent an unexpected listing.");
  return parsed.data
    .filter((entry) => entry.name !== ".emptyFolderPlaceholder")
    .map((entry) => ({
      name: entry.name,
      folder: !entry.id,
      size: entry.metadata?.size ?? null,
      mimeType: entry.metadata?.mimetype ?? null,
      updatedAt: entry.updated_at ?? null
    }));
}

/** A signed URL for one object, valid for `expiresIn` seconds. */
async function signObject(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  ctx: ConnectorContext,
  bucket: string,
  path: string,
  expiresIn: number
): Promise<{ url: string }> {
  const objectPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await call(
    cfg,
    secrets,
    ctx,
    `/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectPath}`,
    { method: "POST", body: { expiresIn } }
  );
  if (response.status !== 200) throw upstreamError(response, "Could not sign the file URL.");
  const parsed = z.object({ signedURL: z.string().startsWith("/") }).safeParse(parseJson(response));
  if (!parsed.success)
    throw new ConnectorError("upstream", "Supabase sent an unexpected signed URL.");
  return { url: `${cfg.projectUrl}/storage/v1${parsed.data.signedURL}` };
}

async function test(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  ctx: ConnectorContext
): Promise<TestResult> {
  try {
    const { doc, latencyMs } = await readOpenApi(cfg, secrets, ctx);
    const count = readTables(doc).length;
    return {
      ok: true,
      message: `Connected. ${count} table${count === 1 ? "" : "s"} and views visible.`,
      latencyMs
    };
  } catch (error) {
    if (error instanceof ConnectorError) return { ok: false, message: error.message, latencyMs: 0 };
    throw error;
  }
}

async function listResources(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  ctx: ConnectorContext
): Promise<Resource[]> {
  const { doc } = await readOpenApi(cfg, secrets, ctx);
  const tables: Resource[] = readTables(doc).map((t: SupabaseTable) => ({
    id: `${t.kind}:${t.name}`,
    kind: t.kind,
    name: t.name,
    structure: t
  }));
  const functions: Resource[] = readFunctions(doc).map((f: SupabaseFunction) => ({
    id: `rpc:${f.name}`,
    kind: "rpc",
    name: f.name,
    structure: f
  }));
  const buckets: Resource[] = (await readBuckets(cfg, secrets, ctx)).map((b) => ({
    id: `bucket:${b.name}`,
    kind: "bucket",
    name: b.name,
    structure: b
  }));
  return [...tables, ...functions, ...buckets];
}

async function execute(
  cfg: SupabaseConfig,
  secrets: SupabaseSecrets,
  req: { resourceId: string; params: Record<string, unknown>; userToken?: string },
  ctx: ConnectorContext
): Promise<ExecuteResult> {
  if (req.resourceId === AUTH_RESOURCE_ID)
    return { status: 200, data: await runAuth(cfg, secrets, ctx, req.params, req.userToken) };
  let resource: ReturnType<typeof parseResourceId>;
  try {
    resource = parseResourceId(req.resourceId);
  } catch {
    throw new ConnectorError("invalid_request", "Unknown Supabase resource.");
  }
  const parsed = supabaseRequestSchema.safeParse(req.params);
  if (!parsed.success)
    throw new ConnectorError(
      "invalid_request",
      parsed.error.issues[0]?.message ?? "The request is not valid."
    );
  const request = parsed.data;
  // A request may name another exposed schema; storage has no schema.
  const scoped = "schema" in request && request.schema ? { ...cfg, schema: request.schema } : cfg;

  if (request.op === "storage.list" || request.op === "storage.sign") {
    if (resource.kind !== "bucket")
      throw new ConnectorError("invalid_request", "Storage requests need a bucket.");
    if (request.op === "storage.sign")
      return {
        status: 200,
        data: await signObject(cfg, secrets, ctx, resource.name, request.path, request.expiresIn)
      };
    const entries = await listObjects(cfg, secrets, ctx, resource.name, request.prefix, 1000);
    return { status: 200, data: entries };
  }
  if (request.op === "rpc") {
    if (resource.kind !== "rpc")
      throw new ConnectorError("invalid_request", "This resource is not a function.");
    const response = await call(
      scoped,
      secrets,
      ctx,
      `/rest/v1/rpc/${encodeURIComponent(resource.name)}`,
      {
        method: "POST",
        body: request.args,
        userToken: req.userToken
      }
    );
    if (response.status >= 400) throw upstreamError(response, "The function call failed.");
    return { status: response.status, data: parseJson(response) };
  }
  if (resource.kind !== "table" && resource.kind !== "view")
    throw new ConnectorError("invalid_request", "This resource is not a table or view.");
  const query = tableQuery(request).toString();
  const path = `/rest/v1/${encodeURIComponent(resource.name)}${query ? `?${query}` : ""}`;
  const response = await call(scoped, secrets, ctx, path, {
    userToken: req.userToken,
    method: TABLE_METHODS[request.op],
    ...(request.op === "insert" || request.op === "update" ? { body: request.values } : {}),
    ...(request.op === "select"
      ? {}
      : {
          prefer:
            request.op === "insert" && request.upsert
              ? "resolution=merge-duplicates,return=representation"
              : "return=representation"
        })
  });
  if (response.status >= 400) throw upstreamError(response, "Supabase refused the request.");
  return { status: response.status, data: parseJson(response) };
}

export const supabaseConnector: Connector<SupabaseConfig, SupabaseSecrets> = {
  type: "supabase",
  configSchema: supabaseConfigSchema as unknown as z.ZodType<SupabaseConfig>,
  secretsSchema: supabaseSecretsSchema,
  test,
  listResources,
  execute
};

registerConnector(supabaseConnector);
