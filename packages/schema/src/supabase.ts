import { z } from "zod";
import { RESERVED_STATE_NAMES, type AppEnum, type StateType } from "./state";

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
  buckets: z.array(supabaseBucketSchema).max(500)
});

export type SupabaseColumn = z.infer<typeof supabaseColumnSchema>;
export type SupabaseTable = z.infer<typeof supabaseTableSchema>;
export type SupabaseFunction = z.infer<typeof supabaseFunctionSchema>;
export type SupabaseBucket = z.infer<typeof supabaseBucketSchema>;
export type SupabaseStructure = z.infer<typeof supabaseStructureSchema>;

const INT_TYPES = new Set(["smallint", "integer", "bigint", "int2", "int4", "int8"]);
const FLOAT_TYPES = new Set([
  "real",
  "double precision",
  "float4",
  "float8",
  "numeric",
  "decimal",
  "money"
]);
const TIME_TYPES = new Set([
  "timetz",
  "time",
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
  if (INT_TYPES.has(base)) return "int";
  if (FLOAT_TYPES.has(base)) return "float";
  if (base === "boolean" || base === "bool") return "boolean";
  if (TIME_TYPES.has(base)) return "timestamptz";
  if (base === "json" || base === "jsonb") return "json";
  return "string";
}

/** PostgreSQL's own short names for the long spellings PostgREST reports. */
const SHORT_PG_TYPES: Record<string, string> = {
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  "time with time zone": "timetz",
  "time without time zone": "time",
  "character varying": "varchar",
  character: "char",
  "double precision": "float8",
  real: "float4",
  integer: "int4",
  bigint: "int8",
  smallint: "int2",
  boolean: "bool",
  "bit varying": "varbit"
};

/**
 * PostgreSQL's short type name: `timestamp with time zone` as `timestamptz`, `integer` as `int4`,
 * `public.role` as `role` (types of other schemas keep their schema). Lists keep their `[]`.
 */
export function shortPgType(pgType: string): string {
  const trimmed = pgType.trim();
  const list = trimmed.endsWith("[]");
  const core = list ? trimmed.slice(0, -2).trim() : trimmed;
  const match = /^([^(]+?)\s*(\(.*\))?$/.exec(core);
  const base = (match?.[1] ?? core)
    .toLowerCase()
    .replace(/^public\./, "")
    .replace(/"/g, "");
  return `${SHORT_PG_TYPES[base] ?? base}${match?.[2] ?? ""}${list ? "[]" : ""}`;
}

/**
 * The app enum name for a Postgres enum type: `public.order_status` as `order_status`,
 * `billing.plan` as `billing_plan`; a name the app reserves gets `_enum` added.
 */
export function enumNameOf(pgType: string): string {
  let name = shortPgType(pgType)
    .replace(/\[\]$/, "")
    .replace(/[^A-Za-z0-9_]/g, "_");
  if (!/^[A-Za-z_]/.test(name)) name = `_${name}`;
  return RESERVED_STATE_NAMES.has(name) ? `${name}_enum` : name;
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

/** A Postgres enum used by a column: its type name (without `[]`) and values in order. */
export interface SupabaseEnum {
  name: string;
  values: string[];
}

/** The Postgres enums a table's columns use, once each, in column order. */
export function tableEnums(table: SupabaseTable): SupabaseEnum[] {
  const found = new Map<string, string[]>();
  for (const column of table.columns) {
    if (!column.enumValues) continue;
    const name = enumNameOf(column.pgType);
    if (!found.has(name)) found.set(name, column.enumValues);
  }
  return [...found].map(([name, values]) => ({ name, values }));
}

/** True when the app already has an enum of this name with exactly these values, in order. */
export function enumInSync(enums: readonly AppEnum[], item: SupabaseEnum): boolean {
  const saved = enums.find((e) => e.name === item.name);
  return (
    saved !== undefined &&
    saved.values.length === item.values.length &&
    saved.values.every((v, i) => v === item.values[i])
  );
}

/**
 * The app enums with these Supabase enums saved: an enum of the same name gets the fetched values
 * (in order, description kept); a new name is added. `newId` makes ids for added enums.
 */
export function saveSupabaseEnums(
  enums: readonly AppEnum[],
  items: readonly SupabaseEnum[],
  newId: () => string
): AppEnum[] {
  const next = [...enums];
  for (const item of items) {
    const at = next.findIndex((e) => e.name === item.name);
    if (at >= 0) next[at] = { ...(next[at] as AppEnum), values: [...item.values] };
    else
      next.push({
        id: newId(),
        name: item.name,
        description: "From Supabase",
        values: [...item.values]
      });
  }
  return next;
}
