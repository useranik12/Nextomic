import { z } from "zod";
import { walkElements, type ElementNode } from "./element";
import { activeQuery, querySingle, SUPABASE_OPERATOR_LABELS, type ElementQuery } from "./query";

// Refresh Query (docs/dynamic-data-and-actions.md section 8): an action runs a query loop of the
// page again, optionally with new values for the settings the loop exposes.

/** A value Refresh Query can change on a loop: its name in the action and what the panel calls it. */
export interface RefreshField {
  name: string;
  label: string;
}

/**
 * The settings of a loop that Refresh Query can give new values: a Supabase loop's filter values
 * (`filter:<filter id>`), a REST loop's call variables (`var:<name>`, from `restVariables`), and
 * the Limit of either when the loop gives a list. Other Loops read page data, so they have none.
 */
export function refreshFields(
  query: ElementQuery,
  restVariables: readonly string[] = []
): RefreshField[] {
  if (query.source === "local") return [];
  const fields: RefreshField[] =
    query.source === "supabase"
      ? query.supabase.filters.map((f) => ({
          name: `filter:${f.id}`,
          label: `${f.column || "Filter"} (${SUPABASE_OPERATOR_LABELS[f.operator]})`
        }))
      : restVariables.map((name) => ({ name: `var:${name}`, label: name }));
  if (!querySingle(query)) fields.push({ name: "limit", label: "Limit" });
  return fields;
}

/**
 * New setting values for loops, by loop element id then field name (see `refreshFields`). They
 * come from a browser, so a value is plain text: it never holds a {{ tag }}, which the server
 * would fill with its own data.
 */
export const queryValuesSchema = z.record(
  z.string().min(1).max(64),
  z.record(
    z.string().max(70),
    z
      .string()
      .max(5000)
      .refine((value) => !value.includes("{{"), "Values cannot hold dynamic tags.")
  )
);
export type QueryValues = z.infer<typeof queryValuesSchema>;

const MAX_LOOPS = 50;

/** A copy of the tree whose loops use the given values; unknown loops and fields are ignored. */
export function applyQueryValues(tree: ElementNode, values: Readonly<QueryValues>): ElementNode {
  const count = Object.keys(values).length;
  if (count === 0 || count > MAX_LOOPS) return tree;
  const copy = structuredClone(tree);
  walkElements(copy, (node) => {
    const given = values[node.id];
    const query = node.query;
    if (!given || !query || !activeQuery(node)) return;
    for (const [name, value] of Object.entries(given)) {
      if (name === "limit") {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) continue;
        if (query.source === "supabase") query.supabase.limit = limit;
        else if (query.source === "rest") query.rest.limit = limit;
      } else if (name.startsWith("filter:") && query.source === "supabase") {
        const filter = query.supabase.filters.find((f) => f.id === name.slice(7));
        if (filter) filter.value = value;
      } else if (name.startsWith("var:") && query.source === "rest") {
        query.rest.values[name.slice(4)] = value;
      }
    }
  });
  return copy;
}
