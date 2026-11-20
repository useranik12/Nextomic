// The state the Design tab edits (one select for the whole panel). Every element has the browser
// states; form fields add the states their own parts know (docs/elements.md "Form design states").
// Ordinary settings are stored per browser state (`PseudoState`); the form-only states exist for
// the Form design groups, whose part keys carry the state in their name (input-design.ts).

import { INPUT_STATE_LABELS, type InputState } from "./input-design";
import type { PseudoState } from "./style";

export type EditState = PseudoState | "checked" | "error" | "success";

const BROWSER_STATES: PseudoState[] = ["default", "hover", "focus", "active", "disabled"];

const FIELD_STATES: Record<string, EditState[]> = {
  input: ["error", "success"],
  checkbox: ["checked", "error", "success"],
  checkboxGroup: ["checked", "error", "success"],
  radio: ["checked", "error", "success"],
  choiceChips: ["checked", "error", "success"],
  pinInput: ["checked", "error", "success"],
  counter: ["error", "success"],
  rangeSlider: ["error", "success"],
  dateTime: ["checked", "error", "success"],
  select: ["checked", "error", "success"],
  video: ["checked"],
  audio: ["checked"]
};

/** The states an element can be edited in, in select order. */
export function editStatesFor(type: string): EditState[] {
  return [...BROWSER_STATES, ...(FIELD_STATES[type] ?? [])];
}

/** The word for a state. A single-choice field says Selected where the others say Checked. */
export function editStateLabel(type: string, state: EditState): string {
  if (state === "checked" && (type === "video" || type === "audio")) return "On";
  if (state === "checked" && type === "pinInput") return "Filled";
  if (state === "checked" && (type === "dateTime" || type === "select")) return "Selected";
  if (state === "checked")
    return type === "radio" || type === "choiceChips" ? "Selected" : "Checked";
  if (state === "active") return "Active";
  return INPUT_STATE_LABELS[state as InputState] ?? state;
}

/** The browser state an ordinary setting is stored under; null for the form-only states. */
export function pseudoOf(state: EditState): PseudoState | null {
  return BROWSER_STATES.includes(state as PseudoState) ? (state as PseudoState) : null;
}

/** The part state a Form design setting is stored under; null when parts have no such state. */
export function partStateOf(state: EditState): InputState | null {
  return state === "active" ? null : state;
}
