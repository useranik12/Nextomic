// Design of choice fields: Checkbox, Radio, Checkbox group and Choice chips (docs/elements.md
// "Form Options design"). Same method as the Form Input design (input-design.ts): every part is a
// sub-group stored as `--nxt-ip-<part>-<property>[-<state>]` in the ordinary style map. The Option
// element has no design of its own; the field that holds the options styles every option through
// the parts below, so all options of one field always look alike.

import {
  DESIGN_KIT,
  INPUT_PARTS,
  parseInputDesignKey,
  type InputPart,
  type InputState,
  type ParsedInputKey,
  type StateTail
} from "./input-design";
import { COUNTER_PANEL_PARTS, COUNTER_PARTS } from "./counter-design";
import { DATE_PANEL_PARTS, DATE_PARTS } from "./date-design";
import { PIN_PANEL_PARTS, PIN_PARTS } from "./pin-design";
import { RANGE_PANEL_PARTS, RANGE_PARTS } from "./range-design";
import { SELECT_PANEL_PARTS, SELECT_PARTS } from "./select-design";

const { p, TEXT, SPACING, BORDER, EFFECTS, SIZE, ORDER } = DESIGN_KIT;

const ROW = "[data-nxt-choice]";
const CONTROL = "[data-nxt-control]";

/**
 * How each state reaches one option row. Every test sits inside :where() so all states weigh the
 * same and the cascade order (hover, focus, checked, error, disabled) decides; a state weighs one
 * more than the default through the doubled row selector, so it also wins at another breakpoint.
 */
const rowStates = (sub: string): Partial<Record<InputState, StateTail[]>> => {
  const forced = (state: string) => `:where([data-nxt-force="${state}"])`;
  const row = (test: string) => `${ROW}${ROW}${test}${sub}`;
  const at = (state: string, test: string): StateTail[] => [
    { field: "", tail: ` ${row(test)}` },
    { field: forced(state), tail: ` ${row("")}` }
  ];
  return {
    default: [{ field: "", tail: ` ${ROW}${sub}` }],
    hover: at("hover", ":where(:hover)"),
    focus: at("focus", `:has(:where(${CONTROL}:focus-visible))`),
    checked: at("checked", `:has(:where(${CONTROL}:checked))`),
    error: [
      { field: ":where([data-invalid])", tail: ` ${row("")}` },
      { field: forced("error"), tail: ` ${row("")}` }
    ],
    disabled: at("disabled", `:has(:where(${CONTROL}:disabled))`)
  };
};

const ROW_STATES: InputState[] = ["default", "hover", "focus", "checked", "error", "disabled"];

const rowPart = (
  id: string,
  label: string,
  about: string,
  sub: string,
  groups: InputPart["groups"]
): InputPart => ({
  id,
  label,
  about,
  selector: `${ROW}${sub}`,
  states: ROW_STATES,
  groups,
  stateTails: rowStates(sub)
});

const FLEX_LAYOUT = (gap: string) => ({
  label: "Layout",
  props: [
    p("display", "Display", { options: ["flex", "inline-flex", "grid", "block", "none"] }),
    p("flex-direction", "Direction", {
      options: ["row", "row-reverse", "column", "column-reverse"]
    }),
    p("flex-wrap", "Wrap", { options: ["wrap", "nowrap"] }),
    p("align-items", "Align items", {
      options: ["stretch", "flex-start", "center", "flex-end", "baseline"]
    }),
    p("justify-content", "Justify", {
      options: ["flex-start", "center", "flex-end", "space-between", "space-around"]
    }),
    p("gap", "Gap", { placeholder: gap })
  ]
});

const EVERY_OPTION = "Settings apply to every option of the field.";

const optionsPart: InputPart = {
  id: "options",
  label: "Options list",
  about: "The box that holds all the options.",
  selector: "[data-nxt-options]",
  states: ["default", "hover", "focus", "error", "success", "disabled"],
  groups: [
    {
      label: "Layout",
      props: [
        ...FLEX_LAYOUT("8px").props,
        p("row-gap", "Row gap"),
        p("column-gap", "Column gap"),
        p("grid-template-columns", "Grid columns", {
          placeholder: "repeat(2, 1fr)",
          tip: "Used when Display is grid."
        })
      ]
    },
    SIZE(),
    SPACING,
    BORDER,
    { label: "Effects", props: [p("box-shadow", "Shadow"), p("opacity", "Opacity")] }
  ]
};

const choicePart = rowPart(
  "choice",
  "Option item",
  `One option row: the box, the icon and the text together. ${EVERY_OPTION}`,
  "",
  [
    FLEX_LAYOUT("10px"),
    SIZE(),
    SPACING,
    BORDER,
    TEXT,
    EFFECTS,
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
);

const markPart = rowPart(
  "mark",
  "Check box / radio dot",
  `The box (checkbox) or circle (radio) the visitor sees. ${EVERY_OPTION}`,
  " [data-nxt-mark]",
  [
    {
      label: "Size and shape",
      props: [
        p("width", "Width", { placeholder: "20px" }),
        p("height", "Height", { placeholder: "20px" }),
        p("border-radius", "Radius", { placeholder: "6px" }),
        p("margin", "Margin", { placeholder: "1px 0 0" }),
        ORDER
      ]
    },
    {
      label: "Color and border",
      props: [
        p("background-color", "Background"),
        p("background-image", "Background image", { placeholder: "none" }),
        p("border-width", "Border width", { placeholder: "1.5px" }),
        p("border-style", "Border style", { options: ["solid", "dashed", "dotted", "none"] }),
        p("border-color", "Border color")
      ]
    },
    {
      label: "Effects",
      props: [
        p("box-shadow", "Shadow", { placeholder: "0 0 0 3px rgba(99,102,241,.35)" }),
        p("opacity", "Opacity"),
        p("transition", "Transition", { placeholder: "all .15s ease" }),
        p("display", "Display", { options: ["block", "none"] })
      ]
    }
  ]
);

const tickPart = rowPart(
  "tick",
  "Check mark / dot",
  "The tick or dot drawn inside the box when an option is chosen.",
  " [data-nxt-mark]::after",
  [
    {
      label: "Color",
      props: [
        p("border-color", "Tick color", {
          tip: "The tick of a checkbox is drawn with its border."
        }),
        p("background-color", "Dot color", { tip: "The dot of a radio is a filled circle." }),
        p("opacity", "Opacity")
      ]
    },
    {
      label: "Size and position",
      props: [
        p("width", "Width"),
        p("height", "Height"),
        p("left", "Left"),
        p("top", "Top"),
        p("border-width", "Tick thickness", { placeholder: "0 2px 2px 0" }),
        p("border-radius", "Radius"),
        p("transform", "Transform", { placeholder: "rotate(45deg)" })
      ]
    }
  ]
);

const textPart = rowPart(
  "text",
  "Option label",
  `The text of an option (its subtext sits below it). ${EVERY_OPTION}`,
  " [data-nxt-text]",
  [
    TEXT,
    {
      label: "Layout",
      props: [
        p("display", "Display", { options: ["flex", "block"] }),
        p("flex-direction", "Direction", { options: ["column", "row"] }),
        p("gap", "Gap", { placeholder: "2px" }),
        ORDER
      ]
    },
    SPACING
  ]
);

const subPart = rowPart(
  "sub",
  "Option subtext",
  `The smaller line under the label of an option. ${EVERY_OPTION}`,
  " [data-nxt-sub]",
  [TEXT, SPACING]
);

const icoPart = rowPart(
  "ico",
  "Option icon",
  `The icon chosen on an option. ${EVERY_OPTION}`,
  " [data-nxt-ico]",
  [
    {
      label: "Size and color",
      props: [
        p("font-size", "Size", { placeholder: "18px" }),
        p("width", "Width"),
        p("height", "Height"),
        p("color", "Color"),
        p("opacity", "Opacity")
      ]
    },
    { label: "Spacing and position", props: [...SPACING.props, ORDER] },
    {
      label: "Background",
      props: [p("background-color", "Background"), p("border-radius", "Radius")]
    }
  ]
);

const groupLabelPart: InputPart = {
  id: "grouplabel",
  label: "Group label",
  about: "The title above the options.",
  selector: "[data-nxt-label]",
  states: ["default", "error", "success", "disabled"],
  groups: [
    TEXT,
    {
      label: "Layout",
      props: [p("display", "Display", { options: ["block", "flex", "none"] }), ORDER]
    },
    SPACING
  ]
};

const reqMarkPart: InputPart = {
  id: "reqmark",
  label: "Required marker",
  about: "The star after the label of a required field.",
  selector: "[data-required]::after",
  states: ["default"],
  groups: [
    {
      label: "Marker",
      props: [
        p("content", "Content", { placeholder: '" *"', suggestions: ['" *"', '" (required)"'] }),
        p("color", "Color"),
        p("font-size", "Size"),
        p("font-weight", "Weight", { options: ["400", "500", "600", "700"] }),
        p("margin-left", "Space before")
      ]
    }
  ]
};

const shared = (id: string): InputPart => {
  const part = INPUT_PARTS.find((item) => item.id === id);
  if (!part) throw new Error(`Form design part "${id}" is missing`);
  return part;
};

// The field box and the notes under a choice field are the same parts an Input has.
const FIELD = shared("field");
const HELP = shared("help");
const ERROR = shared("error");
const SUCCESS = shared("success");

/** The parts only choice fields have (the Input parts are `INPUT_PARTS`). */
export const CHOICE_PARTS: readonly InputPart[] = [
  groupLabelPart,
  reqMarkPart,
  optionsPart,
  choicePart,
  markPart,
  tickPart,
  textPart,
  subPart,
  icoPart
];

/** Every part of every form field: the table style keys are read against. */
export const FORM_DESIGN_PARTS: readonly InputPart[] = [
  ...INPUT_PARTS,
  ...CHOICE_PARTS,
  ...PIN_PARTS,
  ...COUNTER_PARTS,
  ...RANGE_PARTS,
  ...DATE_PARTS,
  ...SELECT_PARTS
];

/** The parts of an element, in panel order; empty for elements without a Design > Form group. */
export function designPartsFor(type: string): readonly InputPart[] {
  switch (type) {
    case "input":
      return INPUT_PARTS;
    case "checkbox":
      return [
        FIELD,
        reqMarkPart,
        choicePart,
        markPart,
        tickPart,
        textPart,
        subPart,
        HELP,
        ERROR,
        SUCCESS
      ];
    case "radio":
    case "checkboxGroup":
      return [
        FIELD,
        groupLabelPart,
        reqMarkPart,
        optionsPart,
        choicePart,
        markPart,
        tickPart,
        textPart,
        subPart,
        icoPart,
        HELP,
        ERROR,
        SUCCESS
      ];
    case "choiceChips":
      return [
        FIELD,
        groupLabelPart,
        reqMarkPart,
        optionsPart,
        choicePart,
        textPart,
        subPart,
        icoPart,
        HELP,
        ERROR,
        SUCCESS
      ];
    case "pinInput":
      return PIN_PANEL_PARTS;
    case "counter":
      return COUNTER_PANEL_PARTS;
    case "rangeSlider":
      return RANGE_PANEL_PARTS;
    case "dateTime":
      return DATE_PANEL_PARTS;
    case "select":
      return SELECT_PANEL_PARTS;
    default:
      return [];
  }
}

/** The title of the Design group that holds the parts of this element. */
export function designGroupTitle(type: string): string {
  if (type === "input") return "Form Input";
  if (type === "pinInput") return "Form PIN";
  if (type === "counter") return "Form Counter";
  if (type === "rangeSlider") return "Form Range";
  if (type === "dateTime") return "Form Date and Time";
  if (type === "select") return "Form Select";
  return type === "checkbox" ? "Form Checkbox" : "Form Options";
}

/** Style keys of any form field part; null for anything the tables do not list. */
export function parseFormDesignKey(key: string): ParsedInputKey | null {
  return parseInputDesignKey(key, FORM_DESIGN_PARTS);
}
