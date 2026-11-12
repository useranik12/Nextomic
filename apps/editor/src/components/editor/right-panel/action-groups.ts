import { getAction, type FlowName } from "@nextomic/schema";
import type { DynamicGroup } from "./dynamic-sources";

export const ACTIONS_SECTION = { id: "actions", label: "Actions" };
export const QUERIES_SECTION = { id: "added-queries", label: "Added Queries" };

/** One group per name an action node can read (outputs of earlier nodes, loop items, errors). */
export function actionGroups(names: readonly FlowName[]): DynamicGroup[] {
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
            { token: `${n.name}.item`, label: "Item", hint: "the current item" },
            { token: `${n.name}.index`, label: "Position", hint: "number, from 0" }
          ]
        : n.kind === "error"
          ? [
              { token: `${n.name}.code`, label: "Code", hint: "text" },
              { token: `${n.name}.message`, label: "Message", hint: "text" }
            ]
          : [
              {
                token: n.name,
                label: "Response",
                hint: "the action's output",
                help: `What ${source} answered. Read a field with dot notation: {{ ${n.name}.field }}.`
              }
            ];
    return {
      id: `action-${n.name}`,
      label: `${n.name} · ${source}`,
      section: ACTIONS_SECTION,
      tags
    };
  });
}
