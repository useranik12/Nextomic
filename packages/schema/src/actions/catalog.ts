import type { StateType } from "../state";
import { ACTIONS } from "./catalog-actions";
import type { ParamField, Params } from "./fields";

// The action catalog (docs/dynamic-data-and-actions.md section 8.4). The owner's list in
// `blueprint/action-flow-sytem.md` is the base structure; actions that need an element or a phase
// that is not built yet stay listed with a `disabled` reason, shown greyed with an info hint.
// Control nodes (condition, loop, parallel, try/catch, break, continue, Action Block calls) are
// node kinds in `flow.ts`, not catalog actions. Icons live with the builder UI, not here.

export const ACTION_CATEGORIES = [
  { id: "navigation", label: "Navigation" },
  { id: "backend", label: "Backend/CMS" },
  { id: "state", label: "State Management" },
  { id: "ui", label: "Element/UI Interactions" },
  { id: "alerts", label: "Alert/Notifications" },
  { id: "utilities", label: "Utilities" },
  { id: "share", label: "Share" },
  { id: "media", label: "Media/Animation" },
  {
    id: "integrations",
    label: "Integrations",
    disabled: "Integrations (such as sending email over SMTP) come in a later phase."
  },
  { id: "blocks", label: "Action Blocks" },
  { id: "accessibility", label: "Accessibility" }
] as const satisfies readonly { id: string; label: string; disabled?: string }[];

export type ActionCategory = (typeof ACTION_CATEGORIES)[number]["id"];

/** What an action returns into its output variable. */
export interface OutputSpec {
  type: StateType;
  /** A list, or a list only while a boolean param has this value. */
  list?: boolean | { param: string; when: "true" | "false" };
  /** The param that names the reference (the Supabase table of a row). */
  refParam?: string;
}

export interface ActionDef {
  type: string;
  label: string;
  category: ActionCategory;
  /** Expandable sub-section inside the category ("Supabase Authentication"). */
  subcategory?: string;
  /** Where the action runs; server actions compile to generated handlers with secrets in env. */
  runs: "browser" | "server";
  description: string;
  fields: readonly ParamField[];
  output?: OutputSpec;
  /** Param keys whose values make up the one-line summary on the node. */
  summary?: readonly string[];
  disabled?: string;
}

const BY_TYPE = new Map(ACTIONS.map((a) => [a.type, a]));

export { ACTIONS };

export const getAction = (type: string): ActionDef | undefined => BY_TYPE.get(type);

export const categoryOf = (id: string) => ACTION_CATEGORIES.find((c) => c.id === id);

/** Actions of a category grouped by sub-section, in catalog order (no sub-section first). */
export function actionsByCategory(category: ActionCategory): {
  subcategory: string | null;
  actions: ActionDef[];
}[] {
  const groups = new Map<string | null, ActionDef[]>();
  for (const action of ACTIONS) {
    if (action.category !== category) continue;
    const key = action.subcategory ?? null;
    groups.set(key, [...(groups.get(key) ?? []), action]);
  }
  return [...groups].map(([subcategory, actions]) => ({ subcategory, actions }));
}

/** Why an action cannot be used now (its own reason or its category's), or null. */
export function actionDisabledReason(action: ActionDef): string | null {
  const category = categoryOf(action.category);
  const categoryReason = category && "disabled" in category ? category.disabled : undefined;
  return action.disabled ?? categoryReason ?? null;
}

/** Whether this action, with these params, returns a list. */
export function outputIsList(output: OutputSpec, params: Params): boolean {
  if (typeof output.list !== "object") return output.list ?? false;
  return (params[output.list.param] ?? "false") === output.list.when;
}
