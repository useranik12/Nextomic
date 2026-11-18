"use client";

import { editStateLabel, editStatesFor, type EditState, type ElementNode } from "@nextomic/schema";
import { useEffect } from "react";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { useEditorStore } from "../store/editor-store";
import { ChangeDots } from "./change-dots";
import { useStyleMarks } from "./use-style-marks";

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

/**
 * The state being edited, as one select. Every element has the browser states; a form field adds
 * Checked (or Selected), Error and Success. Everything in the Design tab follows this choice. A
 * dot before the caret says whether the chosen state holds values here (bright) or only others do
 * (faded); the list marks every state that holds values.
 */
export function StateSelect({ node }: { node: ElementNode }) {
  const activeState = useEditorStore((s) => s.activeState);
  const setActiveState = useEditorStore((s) => s.setActiveState);
  const activeClass = useEditorStore((s) => s.activeClass);
  const { index, breakpoint } = useStyleMarks(node);
  const states = editStatesFor(node.type);
  const shown: EditState = states.includes(activeState) ? activeState : "default";
  // The state belongs to this element: another element may not have it.
  useEffect(() => {
    if (shown !== activeState) setActiveState(shown);
  }, [shown, activeState, setActiveState]);
  const options: SelectOption[] = states.map((state) => ({
    value: state,
    label: editStateLabel(node.type, state),
    hint: TIPS[state],
    mark: <ChangeDots marks={index.optionMarks(breakpoint, state)} decorative />
  }));
  return (
    <div
      aria-label="State being edited"
      data-state-select={activeClass ?? "element"}
      className="state-select"
    >
      <SelectField
        label="State being edited"
        hideLabel
        compact
        options={options}
        value={shown}
        valueLabel={editStateLabel(node.type, shown)}
        trailing={<ChangeDots marks={index.stateMarks(breakpoint, shown)} decorative />}
        onValueChange={(next) => setActiveState(next as EditState)}
      />
    </div>
  );
}
