// Design of the PIN / OTP field (docs/elements.md "PIN design"). Same method as the other form
// fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]`. The boxes
// are one repeated part, so one setting styles every box of the field (a filled box is the
// "Checked" state, shown to the visitor as "Filled").

import {
  DESIGN_KIT,
  INPUT_PARTS,
  type InputPart,
  type InputState,
  type StateTail
} from "./input-design";

const { p, TEXT, BORDER, EFFECTS, SIZE, SPACING } = DESIGN_KIT;

const CELL = "[data-nxt-cell]";

/**
 * How each state reaches one box. Tests sit inside :where() so every state weighs the same and the
 * cascade order decides; a state weighs one more than the default through the doubled box
 * selector, so it also wins at another breakpoint. Error and success mark all boxes at once.
 */
const cellStates = (): Partial<Record<InputState, StateTail[]>> => {
  const forced = (state: string) => `:where([data-nxt-force="${state}"])`;
  const box = (test: string) => `${CELL}${CELL}${test}`;
  const at = (state: string, test: string): StateTail[] => [
    { field: "", tail: ` ${box(test)}` },
    { field: forced(state), tail: ` ${box("")}` }
  ];
  return {
    default: [{ field: "", tail: ` ${CELL}` }],
    hover: at("hover", ":where(:hover)"),
    focus: at("focus", ":where(:focus)"),
    checked: at("checked", ":where([data-filled])"),
    error: [
      { field: ":where([data-invalid])", tail: ` ${box("")}` },
      { field: forced("error"), tail: ` ${box("")}` }
    ],
    success: [
      { field: ":where([data-valid])", tail: ` ${box("")}` },
      { field: forced("success"), tail: ` ${box("")}` }
    ],
    disabled: at("disabled", ":where(:disabled)")
  };
};

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
