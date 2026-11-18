import {
  activeQuery,
  queryLabel,
  rowFields,
  type ElementNode,
  type RowShapeContext
} from "@nextomic/schema";
import { QUERIES_SECTION } from "./action-groups";
import type { DynamicGroup, DynamicTag } from "./dynamic-sources";

// Dynamic tag groups for the query loops around an element (innermost first), each read by its
// loop name: the row as `%name.item`, its position as `%name.index`, and for Supabase each column
// of the table, field of the data type or field of the kept action result as `%name.item.<field>`.

function rowTags(node: ElementNode, prefix: string, ctx: RowShapeContext): DynamicTag[] {
  const query = activeQuery(node);
  if (!query) return [];
  const base: DynamicTag[] = [
    {
      token: `${prefix}item`,
      label: "Row",
      hint: "object (one row)",
      help: `The current row of the loop. Read a field with dot notation: {{ ${prefix}item.title }}.`
    },
    { token: `${prefix}index`, label: "Position", hint: "number, from 0" }
  ];
  return [
    ...base,
    ...(rowFields(query, ctx) ?? []).map((field) => ({
      token: `${prefix}item.${field.name}`,
      label: field.name,
      hint: field.isList ? `${field.type}[]` : field.type
    }))
  ];
}

/** One group per enclosing query loop, innermost first. */
export function loopGroups(
  ancestors: readonly ElementNode[],
  ctx: RowShapeContext,
  labelOf: (node: ElementNode) => string
): DynamicGroup[] {
  return ancestors.flatMap((node, depth) => {
    const query = activeQuery(node);
    if (!query) return [];
    return [
      {
        id: `loop-${node.id}`,
        section: QUERIES_SECTION,
        label:
          `%${query.name} · ${queryLabel(labelOf(node), query)}` +
          (depth > 0 ? " (outer loop)" : ""),
        tags: query.name ? rowTags(node, `%${query.name}.`, ctx) : []
      }
    ];
  });
}
