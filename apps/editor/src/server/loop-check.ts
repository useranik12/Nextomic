import {
  findTable,
  loopShapeProblems,
  outputShape,
  sharedResults,
  splitTableRef,
  type ElementNode,
  type FlowsByNode,
  type RowShapeContext,
  type ShapeField,
  type SupabaseStructure
} from "@nextomic/schema";

// Publish gate for Parent Item loops: a list field the parent's rows cannot give would render
// nothing, so it can be saved but not published. Only shapes the saved structure proves are
// checked; a parent whose shape is unknown (an expression, static JSON) never blocks.

export interface LoopCheckItem {
  label: string;
  tree: ElementNode;
  flows?: FlowsByNode;
}

export function loopCheckContext(
  structure: SupabaseStructure | null,
  flows: FlowsByNode | undefined
): RowShapeContext {
  const columns = (ref: string): ShapeField[] | null => {
    const { schema, table } = splitTableRef(ref);
    const found = findTable(structure, schema, table);
    return found
      ? found.columns.map((c) => ({ name: c.name, type: c.type, isList: c.isList }))
      : null;
  };
  const lookup = { columns, restFields: () => null };
  const kept = sharedResults(flows ?? {});
  return {
    ...lookup,
    resultShape: (name) => {
      const result = kept.find((r) => r.name === name);
      return result ? (outputShape(result.type, result.params, lookup)?.fields ?? null) : null;
    }
  };
}

/** Refuses a publish when a loop's list field cannot work; the message names the page. */
export function assertLoopsPublishable(
  structure: SupabaseStructure | null,
  items: readonly LoopCheckItem[]
): void {
  for (const item of items) {
    const problem = loopShapeProblems(item.tree, loopCheckContext(structure, item.flows))[0];
    if (!problem) continue;
    const error = new Error(`${item.label}: ${problem.message}`);
    error.name = "FormError";
    throw error;
  }
}
