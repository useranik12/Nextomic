import { z } from "zod";
import type { RestConfig } from "./rest";
import type { SupabaseColumn, SupabaseStructure, SupabaseTable } from "./supabase";

// Query loops (docs/dynamic-data-and-actions.md sections 2 to 4): a Container or Section can run a
// backend query, Supabase (a table or view with filters and order) or REST (a saved API Data
// call), and repeat its children once per row. Values here are templates: static text mixed with
// {{ }} dynamic data, filled where the query runs. Row data is never stored.

/** Element types that can hold a query loop (owner decision: Container and Section only). */
export const QUERY_LOOP_TYPES: ReadonlySet<string> = new Set(["container", "section"]);

export const canHaveQuery = (type: string) => QUERY_LOOP_TYPES.has(type);

export const QUERY_SOURCES = ["supabase", "rest"] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

export const QUERY_SOURCE_LABELS: Record<QuerySource, string> = {
  supabase: "Supabase Query",
  rest: "REST API"
};

/** PostgREST filter operators a query loop offers. */
export const SUPABASE_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "in",
  "is",
  "contains",
  "containedBy",
  "overlaps"
] as const;
export type SupabaseOperator = (typeof SUPABASE_OPERATORS)[number];

export const SUPABASE_OPERATOR_LABELS: Record<SupabaseOperator, string> = {
  eq: "Equal to",
  neq: "Not equal to",
  gt: "Greater than",
  gte: "Greater than or equal to",
  lt: "Less than",
  lte: "Less than or equal to",
  like: "Like (case-sensitive, % wildcard)",
  ilike: "Like (any case, % wildcard)",
  in: "In list (comma-separated)",
  is: "Is (null, true or false)",
  contains: "Contains",
  containedBy: "Contained by",
  overlaps: "Overlaps"
};

const ORDERED: SupabaseOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"];
const UUID_LIKE = /^(uuid|inet|cidr|macaddr)$/i;

/**
 * Operators PostgREST accepts for a column, by its type: lists and JSON take containment, text
 * takes pattern matching, numbers and times take ranges, booleans equality. `is` works on all.
 */
export function operatorsFor(
  column: Pick<SupabaseColumn, "type" | "isList" | "pgType" | "enumValues">
): SupabaseOperator[] {
  if (column.isList) return ["contains", "containedBy", "overlaps", "is"];
  if (column.type === "json") return ["contains", "containedBy", "is"];
  if (column.type === "boolean") return ["eq", "neq", "is"];
  if (column.type === "int" || column.type === "float" || column.type === "timestamptz")
    return ORDERED;
  if (column.enumValues || UUID_LIKE.test(column.pgType.trim())) return ["eq", "neq", "in", "is"];
  return ["eq", "neq", "like", "ilike", "in", "is"];
}

const id = z.string().min(1).max(64);
const column = z.string().max(63).default("");
/** Static text mixed with {{ }} dynamic data. */
const template = z.string().max(10_000).default("");
const limit = z.number().int().min(1).max(1000).default(20);

export const queryFilterSchema = z.object({
  id,
  column,
  operator: z.enum(SUPABASE_OPERATORS).default("eq"),
  value: template
});

export const queryOrderSchema = z.object({
  id,
  column,
  ascending: z.boolean().default(true)
});

export const supabaseLoopQuerySchema = z.object({
  /** Database schema of the table or view (public unless the project fetched others). */
  schema: z.string().max(63).default("public"),
  table: z.string().max(200).default(""),
  /** One row (the first match) instead of a list. */
  single: z.boolean().default(false),
  limit,
  filters: z.array(queryFilterSchema).max(50).default([]),
  order: z.array(queryOrderSchema).max(10).default([]),
  /** Streams inserts, updates and deletes to the page (Supabase Realtime, anon key). */
  realtime: z.boolean().default(false),
  /** Loads the next rows when 90% of the loaded rows have been viewed. */
  infiniteScroll: z.boolean().default(false)
});

export const restLoopQuerySchema = z.object({
  callId: z.string().max(64).default(""),
  /** A value for each of the call's variables, by variable name (unset uses its default). */
  values: z.record(z.string().max(64), template).default({}),
  /** The id of a saved JSON path whose value is the list, or "" for the whole response. */
  listPath: z.string().max(64).default(""),
  single: z.boolean().default(false),
  limit,
  infiniteScroll: z.boolean().default(false)
});

/** An element's backend query. Both sources keep their settings while the other is chosen. */
export const elementQuerySchema = z.object({
  enabled: z.boolean().default(false),
  source: z.enum(QUERY_SOURCES).default("supabase"),
  supabase: supabaseLoopQuerySchema.default({}),
  rest: restLoopQuerySchema.default({})
});

export type QueryFilter = z.infer<typeof queryFilterSchema>;
export type QueryOrder = z.infer<typeof queryOrderSchema>;
export type SupabaseLoopQuery = z.infer<typeof supabaseLoopQuerySchema>;
export type RestLoopQuery = z.infer<typeof restLoopQuerySchema>;
export type ElementQuery = z.infer<typeof elementQuerySchema>;

export const newElementQuery = (): ElementQuery => elementQuerySchema.parse({ enabled: true });

/** The query an element runs, or null when it has none or it is turned off. */
export const activeQuery = (node: { type: string; query?: ElementQuery | undefined }) =>
  node.query?.enabled && canHaveQuery(node.type) ? node.query : null;

/** How the query is named in the builder: the element's name and the query type. */
export const queryLabel = (elementName: string, query: ElementQuery) =>
  `${elementName} (${QUERY_SOURCE_LABELS[query.source]})`;

/** A table or view of the saved Supabase structure, by schema and name. */
export function findTable(
  structure: SupabaseStructure | null,
  schema: string,
  table: string
): SupabaseTable | null {
  const entry = structure?.schemas.find((s) => s.schema === schema);
  return entry?.tables.find((t) => t.name === table) ?? null;
}

export interface QuerySources {
  supabase: SupabaseStructure | null;
  rest: RestConfig | null;
}

function supabaseProblems(query: SupabaseLoopQuery, structure: SupabaseStructure | null): string[] {
  if (!structure) return ["Connect Supabase and fetch its schema first."];
  if (!query.table) return ["Choose a table or view."];
  const table = findTable(structure, query.schema, query.table);
  if (!table) return [`The table "${query.table}" is not in the saved schema. Fetch it again.`];
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const problems: string[] = [];
  for (const filter of query.filters) {
    const col = columns.get(filter.column);
    if (!col) problems.push(filter.column ? `No column "${filter.column}".` : "Choose a column.");
    else if (!operatorsFor(col).includes(filter.operator))
      problems.push(`"${SUPABASE_OPERATOR_LABELS[filter.operator]}" does not work on ${col.name}.`);
  }
  for (const order of query.order)
    if (!columns.has(order.column))
      problems.push(order.column ? `No column "${order.column}".` : "Choose a column to order by.");
  return problems;
}

function restProblems(query: RestLoopQuery, config: RestConfig | null): string[] {
  const call = config?.calls.find((c) => c.id === query.callId);
  if (!query.callId || !call) return ["Choose an API call."];
  const problems: string[] = [];
  if (query.listPath && !call.response.jsonPaths.some((p) => p.id === query.listPath))
    problems.push("The chosen JSON path was removed from the API call.");
  return problems;
}

/** What stops a query from running, in display order. Empty when it can run. */
export function queryProblems(query: ElementQuery, sources: QuerySources): string[] {
  if (!query.enabled) return [];
  return query.source === "supabase"
    ? supabaseProblems(query.supabase, sources.supabase)
    : restProblems(query.rest, sources.rest);
}
