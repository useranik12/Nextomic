import { activeQuery, type ElementQuery, type LocalLoopQuery } from "./query";
import { loopAncestors } from "./query-scope";
import type { ElementNode } from "./element";
import { walkElements } from "./element";
import type { OutputLookup, ShapeField } from "./actions/shape";

// What the rows of a query loop look like, from saved structure only (never row data): the columns
// of a Supabase table, the fields of an API Data type, the shape of a kept action result. Used by
// the pickers (tags, list-field suggestions) and by the checks that keep a wrong parent list field
// from being published.

export interface RowShapeContext extends OutputLookup {
  /** Fields of the rows of a kept action result, by its name; null when not known. */
  resultShape: (name: string) => ShapeField[] | null;
}

/** An Expression that is only one kept result: `{{ results.posts }}`. */
const RESULT_EXPRESSION = /^\{\{\s*results\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/;

/** The kept action result a local loop repeats over, when it is one. */
export function loopResultName(local: LocalLoopQuery): string | null {
  if (local.kind === "result") return local.variable || null;
  if (local.kind === "expression")
    return RESULT_EXPRESSION.exec(local.expression.trim())?.[1] ?? null;
  return null;
}

/** The fields of the rows a loop gives, or null when the editor cannot know them. */
export function rowFields(query: ElementQuery, ctx: RowShapeContext): ShapeField[] | null {
  if (query.source === "supabase") {
    const { schema, table } = query.supabase;
    return table ? ctx.columns(`${schema}.${table}`) : null;
  }
  if (query.source === "rest")
    return query.rest.callId && !query.rest.listPath ? ctx.restFields(query.rest.callId) : null;
  const result = loopResultName(query.local);
  return result ? ctx.resultShape(result) : null;
}

/** The fields that can hold a list: list columns and JSON (which may hold one). */
export const listFieldsOf = (fields: readonly ShapeField[]): ShapeField[] =>
  fields.filter((f) => f.isList === true || f.type.toLowerCase() === "json");

/** Why a Parent Item list field cannot work, or null (also null while the rows' shape is unknown). */
export function parentFieldProblem(
  field: string,
  parentName: string,
  fields: readonly ShapeField[] | null
): string | null {
  if (!fields) return null;
  const lists = listFieldsOf(fields);
  if (lists.length === 0)
    return `The rows of %${parentName} have no list or JSON field to loop over.`;
  const head = field.trim().split(/[.[]/)[0] ?? "";
  if (head && !lists.some((f) => f.name === head))
    return `"${head}" is not a list or JSON field of %${parentName}. Choose ${lists.map((f) => f.name).join(", ")}.`;
  return null;
}

export interface LoopShapeProblem {
  nodeId: string;
  message: string;
}

/** Parent Item loops whose list field the parent's rows cannot give. */
export function loopShapeProblems(tree: ElementNode, ctx: RowShapeContext): LoopShapeProblem[] {
  const found: LoopShapeProblem[] = [];
  walkElements(tree, (node) => {
    const query = activeQuery(node);
    if (!query || query.source !== "local" || query.local.kind !== "parent") return;
    const { parentLoop, field } = query.local;
    if (!parentLoop || !field.trim()) return;
    const parent = loopAncestors(tree, node.id).find((n) => activeQuery(n)?.name === parentLoop);
    const parentQuery = parent ? activeQuery(parent) : null;
    if (!parentQuery) return;
    const message = parentFieldProblem(field, parentLoop, rowFields(parentQuery, ctx));
    if (message) found.push({ nodeId: node.id, message });
  });
  return found;
}
