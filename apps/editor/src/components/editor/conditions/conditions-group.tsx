"use client";

import {
  countConditions,
  conditionTexts,
  type ElementNode,
  type Visibility
} from "@nextomic/schema";
import { SwitchRow } from "@/components/ui/switch-row";
import { useEditorStore } from "../store/editor-store";
import { ConditionGroupEditor, newCondition } from "./condition-group-editor";

// The Conditions group of the Element tab (docs/dynamic-data-and-actions.md §7): the element
// renders only when its conditions hold. A failing element is left out of the page entirely (HTML,
// preview and canvas DOM). The Auto / Show / Hide switch previews it on the canvas, unsaved.

const PREVIEW = [
  { value: "auto", label: "Auto" },
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" }
] as const;

const USER_TAG = /\{\{[^}]*\buser\./;

export function ConditionsGroup({ node }: { node: ElementNode }) {
  const setVisibility = useEditorStore((s) => s.setElementVisibility);
  const preview = useEditorStore((s) => s.visibilityPreview[node.id] ?? "auto");
  const setPreview = useEditorStore((s) => s.setVisibilityPreview);
  const failing = useEditorStore((s) => s.conditionsFailed.has(node.id));
  const visibility: Visibility = node.visibility ?? {
    enabled: true,
    group: { id: crypto.randomUUID(), match: "all", items: [] }
  };
  const save = (next: Visibility) =>
    setVisibility(node.id, countConditions(next.group) > 0 ? next : null);
  const total = countConditions(visibility.group);
  const byUser = conditionTexts(visibility.group).some((t) => USER_TAG.test(t));

  if (total === 0)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">
          Show this element only when conditions are true, like a cart that is not empty or a
          signed-in user. When they are false the element is left out of the page.
        </p>
        <button
          type="button"
          onClick={() =>
            save({ ...visibility, group: { ...visibility.group, items: [newCondition()] } })
          }
          className="self-start rounded-full bg-default px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-300 hover:bg-default-hover"
        >
          Add condition
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <SwitchRow
        label="Enable conditions"
        tip="Off keeps the conditions but always shows the element."
        selected={visibility.enabled}
        onChange={(enabled) => save({ ...visibility, enabled })}
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-body">Canvas preview</span>
        <div
          role="radiogroup"
          aria-label="Canvas preview"
          className="flex rounded-full bg-default p-0.5"
        >
          {PREVIEW.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={preview === option.value}
              onClick={() => setPreview(node.id, option.value === "auto" ? null : option.value)}
              className={
                "rounded-full px-2.5 py-1 text-xs transition-colors duration-300 " +
                (preview === option.value
                  ? "bg-default-hover text-foreground"
                  : "text-body hover:text-foreground")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {visibility.enabled && failing ? (
        <p role="status" className="text-xs text-warning">
          {preview === "show"
            ? "The conditions are false now; the canvas shows the element because of Show."
            : "The conditions are false with the preview values, so the element is hidden."}
        </p>
      ) : null}
      {byUser ? (
        <p className="text-xs text-muted">
          Hiding by user or role only changes what shows. Protect data and pages on the server.
        </p>
      ) : null}
      <ConditionGroupEditor
        group={visibility.group}
        depth={1}
        total={total}
        onChange={(group) => save({ ...visibility, group })}
      />
      <p className="text-xs text-muted">
        Values that change in the browser (page state, saved app state) are checked with their
        starting values until live updates arrive.
      </p>
    </div>
  );
}
