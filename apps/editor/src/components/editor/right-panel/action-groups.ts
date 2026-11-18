import {
  getAction,
  outputShape,
  resultTag,
  type OutputLookup,
  type FlowName,
  type SharedResult
} from "@nextomic/schema";
import type { DynamicGroup, DynamicTag } from "./dynamic-sources";

export const ACTIONS_SECTION = { id: "actions", label: "Actions" };
export const QUERIES_SECTION = { id: "added-queries", label: "Added Queries" };

const tag = (token: string, label: string, hint: string, help?: string): DynamicTag => ({
  token,
  label,
  hint,
  help
});

function outputTags(n: FlowName, source: string, lookup: OutputLookup): DynamicTag[] {
  const whole = tag(
    n.name,
    "Response",
    "everything the action answered",
    `What ${source} answered. Read a field with dot notation: {{ ${n.name}.field }}.`
  );
  const shape = n.type ? outputShape(n.type, n.params ?? {}, lookup) : null;
  if (!shape) return [whole];
  const base = shape.list ? `${n.name}[0]` : n.name;
  return [
    whole,
    ...(shape.list
      ? [tag(base, "First item", "object", `The first item of the list: {{ ${n.name}[0].field }}.`)]
      : []),
    ...shape.fields.map((f) => tag(`${base}.${f.name}`, f.name, f.type))
  ];
}

/** One group per name an action node can read (outputs of earlier nodes, loop items, errors). */
export function actionGroups(names: readonly FlowName[], lookup: OutputLookup): DynamicGroup[] {
  return names.map((n) => {
    const source =
      n.kind === "loopItem"
        ? "Loop item"
        : n.kind === "error"
          ? "Error"
          : (n.nodeName ?? getAction(n.type ?? "")?.label ?? "Action Block");
    const tags =
      n.kind === "loopItem"
        ? [
            tag(`${n.name}.item`, "Item", "the current item"),
            tag(`${n.name}.index`, "Position", "number, from 0")
          ]
        : n.kind === "error"
          ? [tag(`${n.name}.code`, "Code", "text"), tag(`${n.name}.message`, "Message", "text")]
          : outputTags(n, source, lookup);
    return {
      id: `action-${n.name}`,
      label: `${n.name} · ${source}`,
      section: ACTIONS_SECTION,
      tags
    };
  });
}

export const RESULTS_SECTION = { id: "results", label: "Action results" };

/**
 * One group per action result the page keeps (`{{ results.name }}`), for every element's picker.
 * Tags use `?.` because the value is empty until the action has run, and an empty value must pass
 * through instead of failing.
 */
export function resultGroups(
  shared: readonly SharedResult[],
  lookup: OutputLookup
): DynamicGroup[] {
  return shared.map((r) => {
    const label = getAction(r.type)?.label ?? "Action";
    const base = resultTag(r.name);
    const shape = outputShape(r.type, r.params, lookup);
    const tags: DynamicTag[] = [
      tag(
        base,
        "Response",
        shape?.list ? "list of objects" : "everything the action answered",
        `What ${label} answered. Empty until it has run. Use it as the list of a Query Loop (Other Loops, Expression).`
      )
    ];
    if (shape?.list) tags.push(tag(`${base}?.[0]`, "First item", "object"));
    if (shape)
      for (const f of shape.fields)
        tags.push(
          tag(shape.list ? `${base}?.[0]?.${f.name}` : `${base}?.${f.name}`, f.name, f.type)
        );
    return {
      id: `result-${r.name}`,
      label: `${r.name} · ${label}`,
      section: RESULTS_SECTION,
      tags
    };
  });
}
