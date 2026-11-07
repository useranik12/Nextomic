import { z } from "zod";
import type { StateType } from "./state";

// The saved STRUCTURE of a Supabase project: tables, views, functions and buckets with their
// columns and types. Never row data. Fetched with the anon key from PostgREST's OpenAPI document
// and the storage API, saved per connector in `connector_schemas`.

const identifier = z.string().min(1).max(200);

export const supabaseColumnSchema = z.object({
  name: identifier,
  /** PostgreSQL type as PostgREST reports it, e.g. `bigint`, `timestamp with time zone`, `text[]`. */
  pgType: z.string().max(200),
  /** Nextomic type of one value (lists use `isList`). */
  type: z.custom<StateType>((v) => typeof v === "string"),
  isList: z.boolean(),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  /** `table.column` this column points to, when it is a foreign key. */
  references: z.string().max(400).nullable(),
  /** Allowed values of a Postgres enum column. */
  enumValues: z.array(z.string().max(200)).max(500).nullable(),
  hasDefault: z.boolean(),
  description: z.string().max(2000).nullable()
});

export const supabaseTableSchema = z.object({
  name: identifier,
  kind: z.enum(["table", "view"]),
  description: z.string().max(2000).nullable(),
  columns: z.array(supabaseColumnSchema).max(1000),
  /** Operations PostgREST offers on it (a view or a table without grants offers fewer). */
  operations: z.array(z.enum(["select", "insert", "update", "delete"])).max(4)
});

export const supabaseFunctionSchema = z.object({
  name: identifier,
  params: z.array(z.object({ name: identifier, pgType: z.string().max(200) })).max(200)
});

export const supabaseBucketSchema = z.object({
  name: identifier,
  public: z.boolean(),
  /** Top-level files and folders seen with the anon key when the schema was fetched (capped). */
  objectCount: z.number().int().min(0),
  countCapped: z.boolean()
});

export const supabaseStructureSchema = z.object({
  schema: z.string().max(63),
  tables: z.array(supabaseTableSchema).max(2000),
  functions: z.array(supabaseFunctionSchema).max(2000),
  buckets: z.array(supabaseBucketSchema).max(500),
  /** User metadata kept across fetches: starred columns per table. */
  favorites: z.record(z.array(identifier).max(1000)).default({})
});

export type SupabaseColumn = z.infer<typeof supabaseColumnSchema>;
export type SupabaseTable = z.infer<typeof supabaseTableSchema>;
export type SupabaseFunction = z.infer<typeof supabaseFunctionSchema>;
export type SupabaseBucket = z.infer<typeof supabaseBucketSchema>;
export type SupabaseStructure = z.infer<typeof supabaseStructureSchema>;

const NUMBER_TYPES = new Set([
  "smallint",
  "integer",
  "bigint",
  "int2",
  "int4",
  "int8",
  "real",
  "double precision",
  "float4",
  "float8",
  "numeric",
  "decimal",
  "money"
]);
const TIME_TYPES = new Set([
  "timestamp with time zone",
  "timestamp without time zone",
  "timestamptz",
  "timestamp",
  "date",
  "time with time zone",
  "time without time zone"
]);

/** The Nextomic type of one value of a PostgreSQL type (array suffixes stripped by the caller). */
export function nextomicTypeOf(pgType: string): StateType {
  const base = pgType
    .trim()
    .toLowerCase()
    .replace(/\(.*\)$/, "");
  if (NUMBER_TYPES.has(base)) return "number";
  if (base === "boolean" || base === "bool") return "boolean";
  if (TIME_TYPES.has(base)) return "timestamptz";
  if (base === "json" || base === "jsonb") return "json";
  return "string";
}

/** Splits `text[]` / `character varying[]` into the element type and a list flag. */
export function splitArrayType(pgType: string): { base: string; isList: boolean } {
  const trimmed = pgType.trim();
  return trimmed.endsWith("[]")
    ? { base: trimmed.slice(0, -2), isList: true }
    : { base: trimmed, isList: false };
}

/** Table and view names a Supabase Row type can point at. */
export function supabaseRowTargets(structure: SupabaseStructure | null): string[] {
  return structure ? structure.tables.map((t) => t.name) : [];
}
