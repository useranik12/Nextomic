import { connectors, connectorSchemas, getDb } from "@nextomic/db";
import { ConnectorError, type Resource, type StorageEntry } from "@nextomic/integrations";
import {
  supabaseBucketSchema,
  supabaseFunctionSchema,
  mergeSchemaEntry,
  supabaseRowTargets,
  supabaseSchemaEntrySchema,
  supabaseStructureSchema,
  supabaseTableSchema,
  type SupabaseSchemaEntry,
  type SupabaseStructure
} from "@nextomic/schema";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { proxyConnectorCall, type ProxyCaller } from "./proxy";
import { findConnector } from "./store";

// The saved Supabase structure of a connector: fetched through the proxy pipeline (rate limit,
// audit, SSRF rules), validated, and stored as STRUCTURE only.

export interface SavedSupabaseSchema {
  structure: SupabaseStructure;
  fetchedAt: string;
}

async function supabaseConnectorRow(projectId: string, connectorId: string) {
  const row = await findConnector(projectId, connectorId);
  if (row.type !== "supabase")
    throw new ConnectorError("invalid_request", "This is not a Supabase connector.");
  return row;
}

export async function getSupabaseSchema(
  projectId: string,
  connectorId: string
): Promise<SavedSupabaseSchema | null> {
  const row = await supabaseConnectorRow(projectId, connectorId);
  const [saved] = await getDb()
    .select()
    .from(connectorSchemas)
    .where(eq(connectorSchemas.connectorId, row.id))
    .limit(1);
  if (!saved) return null;
  const structure = supabaseStructureSchema.safeParse(saved.structure);
  return structure.success
    ? { structure: structure.data, fetchedAt: saved.fetchedAt.toISOString() }
    : null;
}

/**
 * One schema's tables and functions plus the buckets, from the connector's resources; anything
 * malformed is dropped.
 */
export function structureFromResources(
  resources: Resource[],
  schema: string
): { entry: SupabaseSchemaEntry; buckets: SupabaseStructure["buckets"] } {
  const pick = <T>(kind: string[], parser: z.ZodType<T>) =>
    resources
      .filter((r) => kind.includes(r.kind))
      .map((r) => parser.safeParse(r.structure))
      .flatMap((r) => (r.success ? [r.data] : []));
  return {
    entry: supabaseSchemaEntrySchema.parse({
      schema,
      tables: pick(["table", "view"], supabaseTableSchema),
      functions: pick(["rpc"], supabaseFunctionSchema)
    }),
    buckets: pick(["bucket"], supabaseBucketSchema)
  };
}

async function writeStructure(connectorId: string, structure: SupabaseStructure) {
  const hash = createHash("sha256").update(JSON.stringify(structure)).digest("hex");
  const fetchedAt = new Date();
  await getDb()
    .insert(connectorSchemas)
    .values({ connectorId, structure, hash, fetchedAt })
    .onConflictDoUpdate({
      target: connectorSchemas.connectorId,
      set: { structure, hash, fetchedAt }
    });
  return fetchedAt;
}

export async function fetchSupabaseSchema(
  caller: ProxyCaller,
  connectorId: string
): Promise<SavedSupabaseSchema> {
  const row = await supabaseConnectorRow(caller.projectId, connectorId);
  const result = await proxyConnectorCall(caller, row.id, { op: "resources" });
  if (!result.ok) throw new ConnectorError(result.error.code, result.error.message);
  const schema = typeof row.config.schema === "string" ? row.config.schema : "public";
  const { entry, buckets } = structureFromResources(result.data as Resource[], schema);
  // Fetching a schema adds it to (or refreshes it in) the saved set; other schemas stay.
  const previous = await getSupabaseSchema(caller.projectId, row.id);
  const structure = mergeSchemaEntry(previous?.structure ?? null, entry, buckets);
  const fetchedAt = await writeStructure(row.id, structure);
  return { structure, fetchedAt: fetchedAt.toISOString() };
}

/** Removes one saved schema; removing the last one removes the saved structure. */
export async function clearSupabaseSchema(
  projectId: string,
  connectorId: string,
  schema: string
): Promise<void> {
  const row = await supabaseConnectorRow(projectId, connectorId);
  const saved = await getSupabaseSchema(projectId, row.id);
  const rest = saved?.structure.schemas.filter((s) => s.schema !== schema) ?? [];
  if (!saved || rest.length === 0) {
    await getDb().delete(connectorSchemas).where(eq(connectorSchemas.connectorId, row.id));
    return;
  }
  await writeStructure(row.id, { ...saved.structure, schemas: rest });
}

/** Live listing of one folder of a bucket. Never saved. */
export async function browseSupabaseBucket(
  caller: ProxyCaller,
  connectorId: string,
  bucket: string,
  prefix: string
): Promise<StorageEntry[]> {
  const row = await supabaseConnectorRow(caller.projectId, connectorId);
  const result = await proxyConnectorCall(caller, row.id, {
    op: "execute",
    request: { resourceId: `bucket:${bucket}`, params: { op: "storage.list", prefix } }
  });
  if (!result.ok) throw new ConnectorError(result.error.code, result.error.message);
  return (result.data as { data: StorageEntry[] }).data;
}

/** A short-lived signed URL for one file of a bucket (private buckets need it for previews). */
export async function signSupabaseObject(
  caller: ProxyCaller,
  connectorId: string,
  bucket: string,
  path: string
): Promise<string> {
  const row = await supabaseConnectorRow(caller.projectId, connectorId);
  const result = await proxyConnectorCall(caller, row.id, {
    op: "execute",
    request: { resourceId: `bucket:${bucket}`, params: { op: "storage.sign", path } }
  });
  if (!result.ok) throw new ConnectorError(result.error.code, result.error.message);
  return (result.data as { data: { url: string } }).data.url;
}

/** Table and view names of the project's saved Supabase schema (empty when none is saved). */
export async function supabaseTableNames(projectId: string): Promise<string[]> {
  const [rows] = await getDb()
    .select({ structure: connectorSchemas.structure })
    .from(connectorSchemas)
    .innerJoin(connectors, eq(connectors.id, connectorSchemas.connectorId))
    .where(and(eq(connectors.projectId, projectId), eq(connectors.type, "supabase")))
    .limit(1);
  const structure = supabaseStructureSchema.safeParse(rows?.structure);
  return supabaseRowTargets(structure.success ? structure.data : null);
}
