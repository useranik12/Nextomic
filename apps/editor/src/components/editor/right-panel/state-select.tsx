"use client";

import {
  editStateLabel,
  editStatesFor,
  parseFormDesignKey,
  type EditState,
  type ElementNode,
  type PseudoState
} from "@nextomic/schema";
import { useEffect } from "react";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { useEditorStore } from "../store/editor-store";

const DOT = "ml-auto h-1.5 w-1.5 rounded-full bg-warning";
const TIPS: Partial<Record<EditState, string>> = {
  default: "The normal look.",
  hover: "While the pointer is over it.",
  focus: "While it has keyboard focus.",
  active: "While it is being pressed.",
  disabled: "When it is turned off.",
  checked: "When it is ticked or chosen.",
  error: "When a check failed.",
  success: "When the checks pass."
};

/** The states that hold a style on this element or class at a breakpoint (for the change dots). */
function changedStates(
  breakpoint: Record<string, Record<string, string> | undefined> | undefined
): Set<EditState> {
  const out = new Set<EditState>();
  if (!breakpoint) return out;
  for (const [state, declarations] of Object.entries(breakpoint)) {
    if (!declarations) continue;
    if (state !== "default" && Object.keys(declarations).length > 0) out.add(state as PseudoState);
    if (state === "default")
      for (const key of Object.keys(declarations)) {
        const hit = parseFormDesignKey(key);
        if (hit && hit.state !== "default") out.add(hit.state);
      }
  }
  return out;
}

/**
 * The state being edited, as one select. Every element has the browser states; a form field adds
 * Checked (or Selected), Error and Success. Everything in the Design tab follows this choice.
 */
export function StateSelect({ node }: { node: ElementNode }) {
  const activeState = useEditorStore((s) => s.activeState);
  const setActiveState = useEditorStore((s) => s.setActiveState);
  const activeClass = useEditorStore((s) => s.activeClass);
  const breakpointId = useEditorStore((s) => s.activeBreakpointId);
  const styles = useEditorStore((s) =>
    s.activeClass ? s.project.classes[s.activeClass] : node.styles
  );
  const states = editStatesFor(node.type);
  const shown: EditState = states.includes(activeState) ? activeState : "default";
  // The state belongs to this element: another element may not have it.
  useEffect(() => {
    if (shown !== activeState) setActiveState(shown);
  }, [shown, activeState, setActiveState]);
  const changed = changedStates(
    styles?.breakpoints[breakpointId] as Record<string, Record<string, string>> | undefined
  );
  const options: SelectOption[] = states.map((state) => ({
    value: state,
    label: editStateLabel(node.type, state),
    hint: TIPS[state],
    icon: changed.has(state) ? (
      <span role="img" aria-label="Has styles in this state" className={DOT} />
    ) : undefined
  }));
  return (
    <div
      aria-label="State being edited"
      data-state-select={activeClass ?? "element"}
      className={
        "[&_.select__trigger]:!h-7 [&_.select__trigger]:!rounded-full [&_.select__trigger]:!border-0 [&_.select__trigger]:!text-xs [&_.select__trigger]:font-mono [&_.select__trigger]:font-medium " +
        (shown === "default"
          ? "[&_.select__trigger]:!bg-violet-500/15 [&_.select__trigger]:!text-violet-700 dark:[&_.select__trigger]:!text-violet-300"
          : "[&_.select__trigger]:!bg-pink-500/20 [&_.select__trigger]:!text-pink-700 [&_.select__trigger]:ring-1 [&_.select__trigger]:ring-pink-500 dark:[&_.select__trigger]:!text-pink-300")
      }
    >
      <SelectField
        label="State being edited"
        hideLabel
        compact
        options={options}
        value={shown}
        onValueChange={(next) => setActiveState(next as EditState)}
      />
    </div>
  );
}
