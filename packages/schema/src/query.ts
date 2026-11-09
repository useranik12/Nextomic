import { z } from "zod";
import { parseJsonPath } from "./json-path";
import type { RestConfig } from "./rest";
import type { SupabaseColumn, SupabaseStructure, SupabaseTable } from "./supabase";

// Query loops (docs/dynamic-data-and-actions.md sections 2 to 4): a Container or Section can run a
// backend query, Supabase (a table or view with filters and order) or REST (a saved API Data
// call), and repeat its children once per row. Values here are templates: static text mixed with
// {{ }} dynamic data, filled where the query runs. Row data is never stored.

/** Element types that can hold a query loop (owner decision: Container and Section only). */
export const QUERY_LOOP_TYPES: ReadonlySet<string> = new Set(["container", "section"]);

export const canHaveQuery = (type: string) => QUERY_LOOP_TYPES.has(type);

export const QUERY_SOURCES = ["supabase", "rest", "local"] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

export const QUERY_SOURCE_LABELS: Record<QuerySource, string> = {
  supabase: "Supabase Query",
  rest: "REST API",
  local: "Other Loops"
};

/**
 * What an "Other Loops" loop repeats over (owner decision 2026-11-09): a page parameter, a page
 * state variable, an app state variable, a constant, a list field of an enclosing loop's row,
 * static JSON, or any expression that gives a list. Values are read on the server or canvas from
 * the page's own data; nothing comes from a visitor.
 */
export const LOCAL_LOOP_KINDS = [
  "param",
  "state",
  "app",
  "const",
  "parent",
  "json",
  "expression"
] as const;
export type LocalLoopKind = (typeof LOCAL_LOOP_KINDS)[number];

export const LOCAL_LOOP_KIND_LABELS: Record<LocalLoopKind, string> = {
  param: "Page Parameters",
  state: "Page State",
  app: "App State",
  const: "Constants",
  parent: "Parent Item",
  json: "Static JSON",
  expression: "Expression"
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
  limit
});

/** A loop name: an identifier, read in expressions as `%name` (empty only on pages saved before names). */
export const LOOP_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Why a loop name cannot be used, or null. `taken` holds the page's other loop names. */
export function loopNameProblem(name: string, taken: readonly string[] = []): string | null {
  if (!name) return "Give the loop a name.";
  if (!LOOP_NAME_PATTERN.test(name))
    return "Use letters, digits and _ only, starting with a letter or _ (up to 64).";
  if (taken.includes(name)) return `Another loop on this page is named "${name}".`;
  return null;
}

const LOCAL_NAME_BASES: Record<LocalLoopKind, string> = {
  param: "parameterLoop",
  state: "pageStateLoop",
  app: "appStateLoop",
  const: "constantLoop",
  parent: "parentLoop",
  json: "jsonLoop",
  expression: "expressionLoop"
};

/** Every default loop name, before a number is added to keep it unique. */
export const LOOP_NAME_BASES: readonly string[] = [
  "supabaseLoop",
  "restLoop",
  ...Object.values(LOCAL_NAME_BASES)
];

/** The default name for a loop with these settings (`supabaseLoop`, `appStateLoop` ...). */
export function loopNameBase(query: { source: QuerySource; local?: { kind: LocalLoopKind } }) {
  if (query.source === "local") return LOCAL_NAME_BASES[query.local?.kind ?? "app"];
  return query.source === "supabase" ? "supabaseLoop" : "restLoop";
}

/** True when a name is still a default (`supabaseLoop`, `restLoop2` ...), so it may follow the type. */
export const isDefaultLoopName = (name: string) =>
  LOOP_NAME_BASES.some((base) => name === base || new RegExp(`^${base}\\d+$`).test(name));

/** Whether a query gives one row instead of a list. */
export function querySingle(query: ElementQuery): boolean {
  return query.source === "supabase"
    ? query.supabase.single
    : query.source === "rest"
      ? query.rest.single
      : query.local.single;
}

export const localLoopQuerySchema = z.object({
  kind: z.enum(LOCAL_LOOP_KINDS).default("app"),
  /** The variable's name, for page parameters, page state, app state and constants. */
  variable: z.string().max(64).default(""),
  /** The enclosing loop whose row holds the list (Parent Item). */
  parentLoop: z.string().max(64).default(""),
  /** Where the list is in that row: `tags`, `images[0].sizes` (a JSON path after `$.`). */
  field: z.string().max(500).default(""),
  /** A JSON array written in the panel (Static JSON). */
  json: z.string().max(100_000).default(""),
  /** One {{ expression }} that gives a list (Expression). */
  expression: template,
  single: z.boolean().default(false),
  limit,
  /** Rows to skip from the start of the list. */
  offset: z.number().int().min(0).max(100_000).default(0)
});

export type LocalLoopQuery = z.infer<typeof localLoopQuerySchema>;

/** An element's query. Each source keeps its settings while another is chosen. */
export const elementQuerySchema = z.object({
  /** How expressions inside the loop read it: `%name.item`, `%name.index`. Unique per page. */
  name: z
    .string()
    .max(64)
    .regex(/^([A-Za-z_][A-Za-z0-9_]*)?$/)
    .default(""),
  enabled: z.boolean().default(false),
  source: z.enum(QUERY_SOURCES).default("supabase"),
  supabase: supabaseLoopQuerySchema.default({}),
  rest: restLoopQuerySchema.default({}),
  local: localLoopQuerySchema.default({})
});

export type QueryFilter = z.infer<typeof queryFilterSchema>;
export type QueryOrder = z.infer<typeof queryOrderSchema>;
export type SupabaseLoopQuery = z.infer<typeof supabaseLoopQuerySchema>;
export type RestLoopQuery = z.infer<typeof restLoopQuerySchema>;
export type ElementQuery = z.infer<typeof elementQuerySchema>;

/** A new enabled query named after its source, with a number when `taken` already has the name. */
export const newElementQuery = (taken: readonly string[] = []): ElementQuery =>
  elementQuerySchema.parse({ enabled: true, name: freeLoopName("supabaseLoop", taken) });

/** `base`, or `base2`, `base3` ... whichever is not taken. */
export function freeLoopName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}${n}`)) return `${base}${n}`;
}

/** The query an element runs, or null when it has none or it is turned off. */
export const activeQuery = (node: { type: string; query?: ElementQuery | undefined }) =>
  node.query?.enabled && canHaveQuery(node.type) ? node.query : null;

/** How the query is named in the builder: the element's name and the query type. */
export const queryLabel = (elementName: string, query: ElementQuery) =>
  `${elementName} (${QUERY_SOURCE_LABELS[query.source]}${
    query.source === "local" ? `: ${LOCAL_LOOP_KIND_LABELS[query.local.kind]}` : ""
  })`;

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

function localProblems(query: LocalLoopQuery): string[] {
  switch (query.kind) {
    case "param":
    case "state":
    case "app":
    case "const":
      return query.variable ? [] : ["Choose a variable."];
    case "parent": {
      if (!query.parentLoop) return ["Choose the loop whose row holds the list."];
      if (!query.field.trim()) return ["Write the field that holds the list, like tags."];
      const parsed = parseJsonPath(`$.${query.field.trim()}`);
      return "error" in parsed ? [`The field is not a valid path: ${parsed.error}`] : [];
    }
    case "json":
      return staticJsonProblem(query.json);
    case "expression":
      return query.expression.trim() ? [] : ["Write an expression that gives a list."];
  }
}

/** Why a Static JSON value cannot be looped over (empty when it is a JSON array). */
export function staticJsonProblem(text: string): string[] {
  if (!text.trim()) return ["Write a JSON array, like [1, 2, 3]."];
  try {
    return Array.isArray(JSON.parse(text)) ? [] : ["The JSON must be an array: [ ... ]."];
  } catch (error) {
    return [`The JSON is not valid: ${error instanceof Error ? error.message : "parse error"}.`];
  }
}

/** What stops a query from running, in display order. Empty when it can run. */
export function queryProblems(query: ElementQuery, sources: QuerySources): string[] {
  if (!query.enabled) return [];
  const naming = loopNameProblem(query.name);
  const problems =
    query.source === "supabase"
      ? supabaseProblems(query.supabase, sources.supabase)
      : query.source === "rest"
        ? restProblems(query.rest, sources.rest)
        : localProblems(query.local);
  return naming ? [naming, ...problems] : problems;
}
