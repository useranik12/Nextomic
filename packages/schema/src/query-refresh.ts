import { z } from "zod";
import { walkFlow, type FlowNode } from "./actions/flow";
import { walkElements, type ElementNode } from "./element";
import { activeQuery, elementQuerySchema, type ElementQuery } from "./query";

// Refresh Query (docs/dynamic-data-and-actions.md section 8.7): an action runs a query loop of the
// page again with query settings the owner edited in the flow editor (the loop's own settings,
// prefilled). The edited query is saved on the action node. A visitor cannot change what a query
// asks for: the browser only sends the filled values of its template slots (filter values, REST
// variable values) and names the action node; the server takes the query itself from the saved
// flow.

export const REFRESH_ACTION = "query.refresh";

/**
 * Settings of a refreshed query that take dynamic data besides the filter and REST variable values
 * (owner decision 2026-11-21): rows per page, rows skipped (where a page starts), the sort column
 * and its direction. They live on the action, never on the loop: a loop keeps plain numbers.
 */
export const BIND_KEYS = ["limit", "offset", "orderColumn", "orderDirection"] as const;
export type BindKey = (typeof BIND_KEYS)[number];

const bindText = z.string().max(2000).optional();
export const refreshBindSchema = z.object({
  limit: bindText,
  offset: bindText,
  orderColumn: bindText,
  orderDirection: bindText
});

/** The query a Refresh Query action saves: the loop's settings plus the templates of its bound settings. */
export const refreshQuerySchema = elementQuerySchema.extend({
  bind: refreshBindSchema.prefault({})
});
export type RefreshQuery = z.infer<typeof refreshQuerySchema>;

const bindOf = (query: ElementQuery | RefreshQuery): z.infer<typeof refreshBindSchema> =>
  "bind" in query ? query.bind : {};

const COLUMN = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const wholeNumber = (text: string, min: number, max: number): number | null => {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** What a filled bound value must look like, or null when it is fine (an empty value keeps the saved setting). */
function bindValueProblem(key: BindKey, text: string): string | null {
  if (text.trim() === "") return null;
  if (key === "limit")
    return wholeNumber(text, 1, 1000) === null
      ? `Rows must be a whole number from 1 to 1000 (got "${text}").`
      : null;
  if (key === "offset")
    return wholeNumber(text, 0, 100_000) === null
      ? `Skip must be a whole number from 0 to 100000 (got "${text}").`
      : null;
  if (key === "orderColumn")
    return COLUMN.test(text.trim()) ? null : `"${text}" is not a column name.`;
  return /^(asc|desc)$/i.test(text.trim())
    ? null
    : `Direction must be asc or desc (got "${text}").`;
}

/** The saved query of a Refresh Query action, or null when it is empty or not a query. */
export function parseRefreshQuery(text: unknown): RefreshQuery | null {
  if (typeof text !== "string" || text.trim() === "") return null;
  try {
    const parsed = refreshQuerySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const restNames = (query: ElementQuery) => Object.keys(query.rest.values).sort();

const ownSlots = (query: ElementQuery | RefreshQuery): string[] =>
  query.source === "supabase"
    ? query.supabase.filters.map((f) => f.value)
    : query.source === "rest"
      ? restNames(query).map((name) => query.rest.values[name] ?? "")
      : [];

/**
 * The templates the browser fills before asking for a refresh, in a fixed order: the Supabase
 * filter values, or the REST variable values by variable name. Other Loops read page data on the
 * server, so they have none.
 */
export function refreshSlots(query: ElementQuery | RefreshQuery): string[] {
  const bind = bindOf(query);
  // The bound settings come last, and only when one is set, so an action saved before them keeps
  // its positions and sends nothing extra.
  const tail = BIND_KEYS.some((key) => bind[key]) ? BIND_KEYS.map((key) => bind[key] ?? "") : [];
  return [...ownSlots(query), ...tail];
}

/**
 * The first problem with the filled values of a refresh (a limit that is not a number ...), as a
 * readable message, or null. The server ignores such a value; the browser reports it instead.
 */
export function bindProblem(
  query: ElementQuery | RefreshQuery,
  values: readonly string[]
): string | null {
  const start = ownSlots(query).length;
  const bind = bindOf(query);
  for (const [at, key] of BIND_KEYS.entries()) {
    if (!bind[key]?.includes("{{")) continue;
    const problem = bindValueProblem(key, values[start + at] ?? "");
    if (problem) return problem;
  }
  return null;
}

/**
 * A copy of the query with its slots replaced by filled values (by position; extras ignored). Only
 * a slot that holds a {{ tag }} takes a value: fixed text stays as saved, so a visitor cannot
 * change it.
 */
export function withSlotValues(
  query: ElementQuery | RefreshQuery,
  values: readonly string[]
): ElementQuery {
  const { bind, ...rest } = structuredClone({ bind: bindOf(query), ...query });
  const next: ElementQuery = rest;
  const start = ownSlots(query).length;
  if (next.source === "supabase") {
    next.supabase.filters.forEach((filter, at) => {
      const value = values[at];
      if (value !== undefined && filter.value.includes("{{")) filter.value = value;
    });
  } else if (next.source === "rest") {
    restNames(next).forEach((name, at) => {
      const value = values[at];
      if (value !== undefined && next.rest.values[name]?.includes("{{"))
        next.rest.values[name] = value;
    });
  }
  // A bound setting takes its filled value only when the owner wrote a {{ tag }} for it and the
  // value is valid; otherwise the saved setting stays.
  const bound = (key: BindKey): string | null => {
    const text = values[start + BIND_KEYS.indexOf(key)];
    if (text === undefined || !bind[key]?.includes("{{")) return null;
    return text.trim() === "" || bindValueProblem(key, text) ? null : text.trim();
  };
  const limit = bound("limit");
  const offset = bound("offset");
  const target =
    next.source === "supabase" ? next.supabase : next.source === "rest" ? next.rest : next.local;
  if (limit !== null) target.limit = Number(limit);
  if (offset !== null) target.offset = Number(offset);
  if (next.source === "supabase") {
    const column = bound("orderColumn");
    const direction = bound("orderDirection");
    if (column !== null) {
      const first = next.supabase.order[0];
      if (first) first.column = column;
      else next.supabase.order.push({ id: "refresh-order", column, ascending: true });
    }
    const first = next.supabase.order[0];
    if (direction !== null && first) first.ascending = direction.toLowerCase() === "asc";
  }
  return next;
}

/**
 * Refreshes the browser asks for, by loop element id: the Refresh Query action node and its
 * filled slot values (null: use the saved templates, filled on the server). Values are plain
 * text: one holding a {{ tag }} is refused, because the server would fill it with its own data.
 */
export const refreshRequestSchema = z
  .record(
    z.string().min(1).max(64),
    z.object({
      node: z.string().min(1).max(64),
      values: z
        .array(
          z
            .string()
            .max(5000)
            .refine((value) => !value.includes("{{"), "Values cannot hold dynamic tags.")
        )
        .max(200)
        .nullable()
    })
  )
  .refine((all) => Object.keys(all).length <= 50, "Too many refreshed loops.");
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

/** The saved query of the Refresh Query action `nodeId` for loop `loopId`, found in these flows. */
export function findRefreshQuery(
  flows: readonly (readonly FlowNode[])[],
  nodeId: string,
  loopId: string
): ElementQuery | null {
  let found: ElementQuery | null = null;
  for (const nodes of flows) {
    walkFlow(nodes, (node) => {
      if (found || node.id !== nodeId || node.kind !== "action") return;
      if (node.type !== REFRESH_ACTION || node.params.query !== loopId) return;
      found = parseRefreshQuery(node.params.override);
    });
    if (found) break;
  }
  return found;
}

/**
 * A copy of the tree whose refreshed loops run the action's saved query with the browser's values.
 * The loop keeps its name, its fail fallback, realtime, infinite scroll and its type: a saved query of another type (the loop
 * changed after the flow was saved) is ignored, so the loop runs as it is.
 */
export function applyRefreshes(
  tree: ElementNode,
  refreshes: Readonly<RefreshRequest>,
  savedQuery: (nodeId: string, loopId: string) => ElementQuery | null
): ElementNode {
  if (Object.keys(refreshes).length === 0) return tree;
  const copy = structuredClone(tree);
  walkElements(copy, (node) => {
    const refresh = refreshes[node.id];
    const current = activeQuery(node);
    if (!refresh || !current) return;
    const saved = savedQuery(refresh.node, node.id);
    if (!saved || saved.source !== current.source) return;
    // Without values the saved templates stay (filled on the server); the bound settings are applied either way.
    const filled = withSlotValues(saved, refresh.values ?? []);
    // Realtime and infinite scroll are wired by the page render, so they stay the loop's own.
    const supabase = {
      ...filled.supabase,
      realtime: current.supabase.realtime,
      infiniteScroll: current.supabase.infiniteScroll
    };
    node.query = {
      ...filled,
      supabase,
      name: current.name,
      enabled: true,
      fallback: current.fallback
    };
  });
  return copy;
}
