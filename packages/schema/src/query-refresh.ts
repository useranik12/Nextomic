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

/** The saved query of a Refresh Query action, or null when it is empty or not a query. */
export function parseRefreshQuery(text: unknown): ElementQuery | null {
  if (typeof text !== "string" || text.trim() === "") return null;
  try {
    const parsed = elementQuerySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const restNames = (query: ElementQuery) => Object.keys(query.rest.values).sort();

/**
 * The templates the browser fills before asking for a refresh, in a fixed order: the Supabase
 * filter values, or the REST variable values by variable name. Other Loops read page data on the
 * server, so they have none.
 */
export function refreshSlots(query: ElementQuery): string[] {
  if (query.source === "supabase") return query.supabase.filters.map((f) => f.value);
  if (query.source === "rest") return restNames(query).map((name) => query.rest.values[name] ?? "");
  return [];
}

/**
 * A copy of the query with its slots replaced by filled values (by position; extras ignored). Only
 * a slot that holds a {{ tag }} takes a value: fixed text stays as saved, so a visitor cannot
 * change it.
 */
export function withSlotValues(query: ElementQuery, values: readonly string[]): ElementQuery {
  const next = structuredClone(query);
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
    const filled = refresh.values ? withSlotValues(saved, refresh.values) : saved;
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
