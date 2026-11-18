// Design of the Count Controller (docs/elements.md "Count Controller design"). Same method as the
// other form fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]`.
// The two buttons are their own parts so each can have its own icon size, color and disabled look
// (a button is disabled at the minimum or maximum).

import { DESIGN_KIT, INPUT_PARTS, type InputPart } from "./input-design";
import { repeatedStates } from "./part-states";

const { p, TEXT, BORDER, EFFECTS, SIZE, SPACING } = DESIGN_KIT;

const buttonStates = (selector: string) =>
  repeatedStates(selector, {
    hover: ":where(:hover)",
    focus: ":where(:focus-visible)",
    disabled: ":where(:disabled)"
  });

const buttonPart = (id: string, label: string, about: string, selector: string): InputPart => ({
  id,
  label,
  about,
  selector,
  states: ["default", "hover", "focus", "disabled"],
  stateTails: buttonStates(selector),
  groups: [
    {
      label: "Icon",
      props: [p("font-size", "Icon size", { placeholder: "24px" }), p("color", "Icon color")]
    },
    SIZE(),
    BORDER,
    SPACING,
    EFFECTS
  ]
});

const counterPart: InputPart = {
  id: "counter",
  label: "Counter box",
  about: "The shell around the two buttons and the count.",
  selector: "[data-nxt-counter]",
  states: ["default", "hover", "focus", "error", "success", "disabled"],
  groups: [
    {
      label: "Layout",
      props: [
        p("display", "Display", { options: ["inline-flex", "flex", "grid", "none"] }),
        p("flex-direction", "Direction", { options: ["row", "row-reverse", "column"] }),
        p("align-items", "Align items", {
          options: ["center", "flex-start", "flex-end", "stretch"]
        }),
        p("justify-content", "Justify", {
          options: ["flex-start", "center", "flex-end", "space-between"]
        }),
        p("gap", "Gap", { placeholder: "4px" })
      ]
    },
    SIZE(),
    SPACING,
    BORDER,
    EFFECTS
  ]
};

const countPart: InputPart = {
  id: "count",
  label: "Count",
  about: "The number between the buttons.",
  selector: "[data-nxt-count]",
  states: ["default", "focus", "error", "success", "disabled"],
  groups: [
    TEXT,
    SIZE(),
    SPACING,
    { label: "Other", props: [p("background-color", "Background"), p("order", "Position order")] }
  ]
};

const shared = (id: string): InputPart => {
  const part = INPUT_PARTS.find((item) => item.id === id);
  if (!part) throw new Error(`Form design part "${id}" is missing`);
  return part;
};

/** Parts only the Count Controller has. */
export const COUNTER_PARTS: readonly InputPart[] = [
  counterPart,
  buttonPart("dec", "Decrease button", "The minus button.", '[data-nxt-step="-1"]'),
  buttonPart("inc", "Increase button", "The plus button.", '[data-nxt-step="1"]'),
  countPart
];

/** The parts of a Count Controller, in panel order. */
export const COUNTER_PANEL_PARTS: readonly InputPart[] = [
  shared("field"),
  shared("label"),
  ...COUNTER_PARTS,
  shared("help"),
  shared("error"),
  shared("success")
];
