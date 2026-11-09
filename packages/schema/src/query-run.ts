import { runExpression, toText } from "./expression";
import { splitTemplate } from "./expression/template";
import { readJsonPath } from "./json-path";
import type { RestLoopQuery, SupabaseLoopQuery, SupabaseOperator } from "./query";
import type { RestCall, RestVariable } from "./rest";
import type { SupabaseColumn, SupabaseTable } from "./supabase";

// How a query loop becomes a connector request, and how the answer becomes rows. Pure, so the
// editor canvas, the server render and the site endpoint share it. Templates are filled by the
// caller (`fillWith`), so loop values of outer loops reach nested queries.

/** Fills the {{ }} parts of a template from an expression scope; a failing part gives "". */
export function fillWith(scope: Readonly<Record<string, unknown>>): (template: string) => string {
  return (template) =>
    splitTemplate(template)
      .map((part) => {
        if (typeof part === "string") return part;
        try {
          return toText(runExpression(part.expr, scope));
        } catch {
          return "";
        }
      })
      .join("");
}

export class QueryInputError extends Error {}

type FilterValue = string | number | boolean | null | (string | number)[] | Record<string, unknown>;

const isNumeric = (c: SupabaseColumn) => c.type === "int" || c.type === "float";

function toNumber(text: string, column: string): number {
  const value = Number(text);
  if (text.trim() === "" || !Number.isFinite(value))
    throw new QueryInputError(`"${text}" is not a number for ${column}.`);
  return value;
}

const listOf = (text: string, column: SupabaseColumn) =>
  text
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "")
    .map((v) => (isNumeric(column) ? toNumber(v, column.name) : v));

/** A filled filter value typed for its column and operator (PostgREST's value forms). */
export function filterInput(
  column: SupabaseColumn,
  operator: SupabaseOperator,
  text: string
): FilterValue {
  if (operator === "is") {
    const word = text.trim().toLowerCase();
    if (word === "null") return null;
    if (word === "true" || word === "false") return word === "true";
    throw new QueryInputError(`"Is" takes null, true or false (${column.name}).`);
  }
  if (operator === "in") return listOf(text, column);
  if (operator === "contains" || operator === "containedBy" || operator === "overlaps") {
    if (column.isList) return listOf(text, column);
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed as Record<string, unknown>;
    } catch {
      // Reported below.
    }
    throw new QueryInputError(`${column.name} needs a JSON object to compare with.`);
  }
  if (isNumeric(column)) return toNumber(text, column.name);
  if (column.type === "boolean") return text.trim().toLowerCase() === "true";
  return text;
}

export interface SupabaseQueryRequest {
  resourceId: string;
  params: {
    op: "select";
    schema: string;
    filters: { column: string; operator: SupabaseOperator; value: FilterValue }[];
    order: { column: string; ascending: boolean }[];
    limit: number;
    offset?: number;
  };
}

/**
 * The connector request of a Supabase query loop. A filter whose filled value is empty is left
 * out (an empty search box means "no filter"); `is` always applies.
 */
export function supabaseQueryRequest(
  query: SupabaseLoopQuery,
  table: SupabaseTable,
  fill: (template: string) => string,
  offset = 0
): SupabaseQueryRequest {
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const filters: SupabaseQueryRequest["params"]["filters"] = [];
  for (const filter of query.filters) {
    const column = columns.get(filter.column);
    if (!column) throw new QueryInputError(`No column "${filter.column}".`);
    const text = fill(filter.value);
    if (text.trim() === "" && filter.operator !== "is") continue;
    const value = filterInput(column, filter.operator, text);
    if (Array.isArray(value) && value.length === 0) continue;
    filters.push({ column: filter.column, operator: filter.operator, value });
  }
  return {
    resourceId: `${table.kind}:${table.name}`,
    params: {
      op: "select",
      schema: query.schema,
      filters,
      order: query.order.map((o) => ({ column: o.column, ascending: o.ascending })),
      limit: query.single ? 1 : query.limit,
      ...(offset > 0 && !query.single ? { offset } : {})
    }
  };
}

/**
 * The variable values of a REST query loop (the call's and its group's variables, see
 * `callVariables`), filled; an empty value uses the variable's default.
 */
export function restQueryValues(
  query: RestLoopQuery,
  variables: readonly RestVariable[],
  fill: (template: string) => string
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of variables) {
    const template = query.values[variable.name];
    if (template === undefined) continue;
    const text = fill(template);
    if (text !== "") values[variable.name] = text;
  }
  return values;
}

export interface QueryRows {
  rows: unknown[];
  /** More rows can be loaded (infinite scroll). */
  hasMore: boolean;
}

/** Supabase rows: the page that came back; a full page means there may be more. */
export function supabaseRows(query: SupabaseLoopQuery, data: unknown): QueryRows {
  const rows = Array.isArray(data) ? data : data === null || data === undefined ? [] : [data];
  if (query.single) return { rows: rows.slice(0, 1), hasMore: false };
  return { rows, hasMore: rows.length >= query.limit };
}

/**
 * REST rows: the chosen JSON path (or the whole response) as a list, then one page of it. An API
 * has no shared paging, so infinite scroll pages through the list it returned.
 */
export function restRows(
  query: RestLoopQuery,
  call: RestCall,
  json: unknown,
  offset = 0
): QueryRows {
  const path = call.response.jsonPaths.find((p) => p.id === query.listPath);
  const value = path ? readJsonPath(json, path.path) : json;
  const all = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  if (query.single) return { rows: all.slice(0, 1), hasMore: false };
  const rows = all.slice(offset, offset + query.limit);
  return { rows, hasMore: offset + query.limit < all.length };
}

/** Every template a query fills, once each: what a client resolves before asking the server. */
export function queryTemplates(query: {
  source: "supabase" | "rest" | "local";
  supabase: SupabaseLoopQuery;
  rest: RestLoopQuery;
}): string[] {
  const all =
    query.source === "supabase"
      ? query.supabase.filters.map((f) => f.value)
      : query.source === "rest"
        ? Object.values(query.rest.values)
        : [];
  return [...new Set(all)];
}

/**
 * A fill function from templates resolved elsewhere (the editor canvas): text without {{ }} is
 * used as written, a template that was not resolved gives "".
 */
export function fillFrom(resolved: Readonly<Record<string, string>>): (template: string) => string {
  return (template) =>
    Object.hasOwn(resolved, template)
      ? (resolved[template] ?? "")
      : template.includes("{{")
        ? ""
        : template;
}
