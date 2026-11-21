import { z } from "zod";
import type { ElementNode } from "./element";
import { QUERY_SOURCES, type ElementQuery } from "./query";
import { loopInstances, type LoopRows } from "./query-loop-rows";
import { fillWith } from "./query-run";

// The state of a query loop as dynamic data (owner request 2026-11-21): `{{ queries.posts.limit }}`.
// It is what the loop runs with right now, after any Refresh Query, so an action can build the
// next one from it (`{{ queries.posts.offset + queries.posts.limit }}`). The server computes it
// where the loop's rows are collected and the browser keeps what it sends back. Only loops that
// are not inside another loop have a state. It reaches the page, so it never holds a value that
// was filled with server-only data (the visitor's token); REST variable values are left out.

export const queryStateSchema = z.object({
  source: z.enum(QUERY_SOURCES),
  /** Rows per page (1 for a single row). */
  limit: z.number().int().min(0).max(1000),
  /** Rows skipped before the first one. */
  offset: z.number().int().min(0).max(100_000),
  /** The page number, from 1: Offset divided by Limit, rounded down, plus one. */
  page: z.number().int().min(1).max(100_001),
  /** Rows loaded now (a loop with infinite scroll counts every page it has loaded). */
  count: z.number().int().min(0),
  /** More rows may exist: a full page came back (Supabase) or the list goes on (REST and Other Loops). */
  hasMore: z.boolean(),
  /** The first sort column ("" when there is none or the source cannot sort). */
  orderBy: z.string().max(200),
  direction: z.enum(["asc", "desc"]),
  /** Every filter in order, with its value filled (a price range is two filters on one column). */
  filters: z
    .array(
      z.object({
        column: z.string().max(200),
        operator: z.string().max(40),
        value: z.string().max(5000)
      })
    )
    .max(50)
});
export type QueryState = z.infer<typeof queryStateSchema>;

/** The state of a loop that ran with these results; `fill` must not use server-only data. */
export function queryStateOf(
  query: ElementQuery,
  fill: (template: string) => string,
  result: { count: number; hasMore: boolean }
): QueryState {
  const own =
    query.source === "supabase"
      ? query.supabase
      : query.source === "rest"
        ? query.rest
        : query.local;
  const limit = own.single ? 1 : own.limit;
  const first = query.source === "supabase" ? query.supabase.order[0] : undefined;
  return {
    source: query.source,
    limit,
    offset: own.offset,
    page: Math.floor(own.offset / Math.max(1, limit)) + 1,
    count: result.count,
    hasMore: result.hasMore,
    orderBy: first?.column ?? "",
    direction: first?.ascending === false ? "desc" : "asc",
    filters:
      query.source === "supabase"
        ? query.supabase.filters.map((f) => ({
            column: f.column,
            operator: f.operator,
            value: fill(f.value).slice(0, 5000)
          }))
        : []
  };
}

/**
 * The state of every named loop of a tree that is not inside another loop, by loop name. A name
 * used twice (a page loop and a template loop) keeps the last one.
 */
export function loopQueryStates(
  root: ElementNode,
  rows: LoopRows,
  scope: Readonly<Record<string, unknown>>
): Record<string, QueryState> {
  const fill = fillWith(scope);
  const out: Record<string, QueryState> = {};
  for (const instance of loopInstances(root, rows)) {
    if (instance.path.length > 0 || instance.query.name === "") continue;
    const result = rows[instance.key];
    if (!result || result.failed) continue;
    out[instance.query.name] = queryStateOf(instance.query, fill, {
      count: result.rows.length,
      hasMore: result.hasMore
    });
  }
  return out;
}

/**
 * Stand-in states for the editor, where no loop has run: each named top-level loop with its own
 * settings and no rows. It lets expressions such as `{{ queries.posts.offset + queries.posts.limit }}`
 * show a value while they are written. Filter values stay as written on the loop.
 */
export function sampleQueryStates(root: ElementNode): Record<string, QueryState> {
  const out: Record<string, QueryState> = {};
  for (const instance of loopInstances(root, {})) {
    if (instance.query.name === "") continue;
    out[instance.query.name] = queryStateOf(instance.query, (template) => template, {
      count: 0,
      hasMore: false
    });
  }
  return out;
}
