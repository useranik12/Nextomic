import { connectors, connectorSchemas, getDb } from "@nextomic/db";
import { ConnectorError, type Resource, type StorageEntry } from "@nextomic/integrations";
import {
  supabaseBucketSchema,
  supabaseFunctionSchema,
  supabaseStructureSchema,
  supabaseTableSchema,
  type SupabaseStructure
} from "@nextomic/schema";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { proxyConnectorCall, type ProxyCaller } from "./proxy";
import { findConnector } from "./store";

// The saved Supabase structure of a connector: fetched through the proxy pipeline (rate limit,
// audit, SSRF rules), validated, and stored as STRUCTURE only. Starred columns are user metadata
// and survive a new fetch.

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

/** Builds the structure from the connector's resources; anything malformed is dropped. */
export function structureFromResources(
  resources: Resource[],
  schema: string,
  favorites: SupabaseStructure["favorites"]
): SupabaseStructure {
  const pick = <T>(kind: string[], parser: z.ZodType<T>) =>
    resources
      .filter((r) => kind.includes(r.kind))
      .map((r) => parser.safeParse(r.structure))
      .flatMap((r) => (r.success ? [r.data] : []));
  const tables = pick(["table", "view"], supabaseTableSchema);
  // Stars on columns that no longer exist are dropped.
  const kept = Object.fromEntries(
    Object.entries(favorites).flatMap(([table, cols]) => {
      const found = tables.find((t) => t.name === table);
      const live = found ? cols.filter((c) => found.columns.some((col) => col.name === c)) : [];
      return live.length > 0 ? [[table, live]] : [];
    })
  );
  return supabaseStructureSchema.parse({
    schema,
    tables,
    functions: pick(["rpc"], supabaseFunctionSchema),
    buckets: pick(["bucket"], supabaseBucketSchema),
    favorites: kept
  });
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
  const previous = await getSupabaseSchema(caller.projectId, row.id);
  const schema = typeof row.config.schema === "string" ? row.config.schema : "public";
  const structure = structureFromResources(
    result.data as Resource[],
    schema,
    previous?.structure.favorites ?? {}
  );
  const fetchedAt = await writeStructure(row.id, structure);
  return { structure, fetchedAt: fetchedAt.toISOString() };
}

export async function clearSupabaseSchema(projectId: string, connectorId: string): Promise<void> {
  const row = await supabaseConnectorRow(projectId, connectorId);
  await getDb().delete(connectorSchemas).where(eq(connectorSchemas.connectorId, row.id));
}

const favoriteInput = z.object({
  table: z.string().min(1).max(200),
  column: z.string().min(1).max(200),
  starred: z.boolean()
});

/** Stars or unstars a column of the saved structure. */
export async function setSupabaseFavorite(
  projectId: string,
  connectorId: string,
  raw: z.input<typeof favoriteInput>
): Promise<SupabaseStructure["favorites"]> {
  const input = favoriteInput.parse(raw);
  const saved = await getSupabaseSchema(projectId, connectorId);
  if (!saved) throw new ConnectorError("not_found", "Fetch the schema first.");
  const table = saved.structure.tables.find((t) => t.name === input.table);
  if (!table?.columns.some((c) => c.name === input.column))
    throw new ConnectorError("not_found", "That column is not in the saved schema.");
  const current = new Set(saved.structure.favorites[input.table] ?? []);
  if (input.starred) current.add(input.column);
  else current.delete(input.column);
  const favorites = { ...saved.structure.favorites, [input.table]: [...current] };
  if (current.size === 0) delete favorites[input.table];
  const structure = { ...saved.structure, favorites };
  const hash = createHash("sha256").update(JSON.stringify(structure)).digest("hex");
  await getDb()
    .update(connectorSchemas)
    .set({ structure, hash })
    .where(eq(connectorSchemas.connectorId, connectorId));
  return favorites;
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

/** Table and view names of the project's saved Supabase schema (empty when none is saved). */
export async function supabaseTableNames(projectId: string): Promise<string[]> {
  const [rows] = await getDb()
    .select({ structure: connectorSchemas.structure })
    .from(connectorSchemas)
    .innerJoin(connectors, eq(connectors.id, connectorSchemas.connectorId))
    .where(and(eq(connectors.projectId, projectId), eq(connectors.type, "supabase")))
    .limit(1);
  const structure = supabaseStructureSchema.safeParse(rows?.structure);
  return structure.success ? structure.data.tables.map((t) => t.name) : [];
}
