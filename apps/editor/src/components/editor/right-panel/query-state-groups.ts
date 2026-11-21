import { activeQuery, loopAncestors, walkElements, type ElementNode } from "@nextomic/schema";
import type { DynamicGroup, DynamicTag } from "./dynamic-sources";

export const QUERY_STATE_SECTION = { id: "query-state", label: "Query state" };

const tag = (token: string, label: string, hint: string, help?: string): DynamicTag => ({
  token,
  label,
  hint,
  help
});

/**
 * One group per named query loop of the page that is not inside another loop: what the loop runs
 * with right now (`{{ queries.posts.offset }}`), so a Refresh Query can build its next settings
 * from it. Read in action flows only: the server fills it, and the flow editor's Test (which runs
 * on the canvas) has no values for it.
 */
export function queryStateGroups(tree: ElementNode | undefined): DynamicGroup[] {
  if (!tree) return [];
  const groups: DynamicGroup[] = [];
  const seen = new Set<string>();
  walkElements(tree, (node) => {
    const query = activeQuery(node);
    if (!query || query.name === "" || seen.has(query.name)) return;
    if (loopAncestors(tree, node.id).length > 0) return;
    seen.add(query.name);
    const base = `queries.${query.name}`;
    const tags: DynamicTag[] = [
      tag(`${base}.limit`, "Rows per page", "number", "How many rows the loop loads at a time."),
      tag(`${base}.offset`, "Offset", "number", "Rows skipped before the first one."),
      tag(`${base}.page`, "Page", "number, from 1", "Offset divided by Rows per page, plus one."),
      tag(`${base}.count`, "Rows loaded", "number", "Rows on the page now."),
      tag(
        `${base}.hasMore`,
        "Has more",
        "true or false",
        "More rows may exist: a full page came back. It does not know the total."
      )
    ];
    if (query.source === "supabase") {
      tags.push(
        tag(`${base}.orderBy`, "Sorted by", "column name"),
        tag(`${base}.direction`, "Direction", "asc or desc")
      );
      query.supabase.filters.forEach((filter, at) =>
        tags.push(
          tag(
            `${base}.filters[${at}].value`,
            `Filter ${at + 1} value`,
            `${filter.column} ${filter.operator}`,
            "The filter's filled value. Filters are in the order set on the loop."
          )
        )
      );
    }
    groups.push({
      id: `query-state-${query.name}`,
      label: `${query.name} · state`,
      section: QUERY_STATE_SECTION,
      tags
    });
  });
  return groups;
}
