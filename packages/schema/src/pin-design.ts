// Design of the PIN / OTP field (docs/elements.md "PIN design"). Same method as the other form
// fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]`. The boxes
// are one repeated part, so one setting styles every box of the field (a filled box is the
// "Checked" state, shown to the visitor as "Filled").

import { DESIGN_KIT, INPUT_PARTS, type InputPart } from "./input-design";
import { repeatedStates } from "./part-states";

const { p, TEXT, BORDER, EFFECTS, SIZE, SPACING } = DESIGN_KIT;

const CELL = "[data-nxt-cell]";

const cellStates = () =>
  repeatedStates(
    CELL,
    {
      hover: ":where(:hover)",
      focus: ":where(:focus)",
      checked: ":where([data-filled])",
      disabled: ":where(:disabled)"
    },
    { error: ":where([data-invalid])", success: ":where([data-valid])" }
  );

const cellsPart: InputPart = {
  id: "cells",
  label: "Boxes row",
  about: "The row that holds all the boxes.",
  selector: "[data-nxt-cells]",
  states: ["default", "hover", "focus", "error", "success", "disabled"],
  groups: [
    {
      label: "Layout",
      props: [
        p("display", "Display", { options: ["flex", "grid", "block", "none"] }),
        p("flex-wrap", "Wrap", { options: ["wrap", "nowrap"] }),
        p("align-items", "Align items", {
          options: ["stretch", "flex-start", "center", "flex-end"]
        }),
        p("justify-content", "Justify", {
          options: ["flex-start", "center", "flex-end", "space-between", "space-around"]
        }),
        p("gap", "Gap", { placeholder: "8px" })
      ]
    },
    SIZE(),
    SPACING,
    { label: "Effects", props: [p("opacity", "Opacity")] }
  ]
};

const cellPart: InputPart = {
  id: "cell",
  label: "Box",
  about: "One box of the code. Settings apply to every box of the field.",
  selector: CELL,
  states: ["default", "hover", "focus", "checked", "error", "success", "disabled"],
  stateTails: cellStates(),
  groups: [
    SIZE(),
    TEXT,
    BORDER,
    SPACING,
    EFFECTS,
    {
      label: "Other",
      props: [p("caret-color", "Caret color"), p("cursor", "Cursor")]
    },
    {
      label: "Focus ring",
      props: [
        p("outline-width", "Outline width", { placeholder: "2px" }),
        p("outline-style", "Outline style", { options: ["solid", "dashed", "dotted", "none"] }),
        p("outline-color", "Outline color"),
        p("outline-offset", "Outline offset", { placeholder: "2px" })
      ]
    }
  ]
};

const shared = (id: string): InputPart => {
  const part = INPUT_PARTS.find((item) => item.id === id);
  if (!part) throw new Error(`Form design part "${id}" is missing`);
  return part;
};

/** Parts only the PIN field has (the rest are the shared Input parts). */
export const PIN_PARTS: readonly InputPart[] = [cellsPart, cellPart];

/** The parts of a PIN field, in panel order. */
export const PIN_PANEL_PARTS: readonly InputPart[] = [
  shared("field"),
  shared("label"),
  shared("required"),
  cellsPart,
  cellPart,
  shared("placeholder"),
  shared("help"),
  shared("error"),
  shared("success")
];
