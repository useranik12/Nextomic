import {
  activeQuery,
  findTable,
  queryLabel,
  type ElementNode,
  type RestConfig,
  type SupabaseStructure
} from "@nextomic/schema";
import type { DynamicGroup, DynamicTag } from "./dynamic-sources";

// Dynamic tag groups for the query loops around an element (innermost first): the row as `item`,
// its position as `index`, and for Supabase each column of the table as `item.<column>`. Outer
// loops are reached through `parent` (`parent.item`, `parent.parent.item`, ...).

export interface LoopSources {
  supabase: SupabaseStructure | null;
  rest: RestConfig | null;
}

function rowTags(node: ElementNode, prefix: string, sources: LoopSources): DynamicTag[] {
  const query = activeQuery(node);
  if (!query) return [];
  const base: DynamicTag[] = [
    {
      token: `${prefix}item`,
      label: "Row",
      hint: query.supabase.single || query.rest.single ? "object" : "object (one row)",
      help: "The current row of the loop. Read a field with dot notation: {{item.title}}."
    },
    { token: `${prefix}index`, label: "Position", hint: "number, from 0" }
  ];
  if (query.source !== "supabase") return base;
  const table = findTable(sources.supabase, query.supabase.schema, query.supabase.table);
  return [
    ...base,
    ...(table?.columns ?? []).map((column) => ({
      token: `${prefix}item.${column.name}`,
      label: column.name,
      hint: column.isList ? `${column.type}[]` : column.type
    }))
  ];
}

/** One group per enclosing query loop, innermost first. */
export function loopGroups(
  ancestors: readonly ElementNode[],
  sources: LoopSources,
  labelOf: (node: ElementNode) => string
): DynamicGroup[] {
  return ancestors.flatMap((node, depth) => {
    const query = activeQuery(node);
    if (!query) return [];
    return [
      {
        id: `loop-${node.id}`,
        label: queryLabel(labelOf(node), query) + (depth > 0 ? " (outer loop)" : ""),
        tags: rowTags(node, "parent.".repeat(depth), sources)
      }
    ];
  });
}
