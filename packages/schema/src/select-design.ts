// Design of the Select field (docs/elements.md "Select design"). Same method as the other form
// fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]` in the ordinary
// style map. The Option element has no design of its own; the Select styles every option through the
// `opt*` parts, so all options of one field look alike. Part ids hold no dash (the key is split at
// the first one) and are unique across every form field.

import {
  DESIGN_KIT,
  INPUT_PARTS,
  type InputPart,
  type InputState,
  type StateTail
} from "./input-design";
import { forcedState, repeatedStates } from "./part-states";

const { p, TEXT, SPACING, BORDER, EFFECTS, SIZE, ORDER } = DESIGN_KIT;

const ROW = "[data-nxt-choice]";

/**
 * How each state reaches one option row. The runtime marks the option under the keyboard or pointer
 * with `data-active` (focus stays on the field or the search box, never on an option) and keeps
 * `aria-selected` and `aria-disabled` current. Every test sits inside :where() so all states weigh
 * the same and the cascade order decides.
 */
const rowStates = (sub: string): Partial<Record<InputState, StateTail[]>> => {
  const row = (test: string) => `${ROW}${ROW}${test}${sub}`;
  const at = (state: string, test: string): StateTail[] => [
    { field: "", tail: ` ${row(test)}` },
    { field: forcedState(state), tail: ` ${row("")}` }
  ];
  return {
    default: [{ field: "", tail: ` ${ROW}${sub}` }],
    hover: at("hover", ":where(:hover)"),
    focus: at("focus", ":where([data-active])"),
    checked: at("checked", ':where([aria-selected="true"])'),
    disabled: at("disabled", ':where([aria-disabled="true"])')
  };
};

const ROW_STATES: InputState[] = ["default", "hover", "focus", "checked", "disabled"];
const EVERY_OPTION = "Settings apply to every option of the field.";

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

const FLEX = (gap: string) => ({
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
      options: ["flex-start", "center", "flex-end", "space-between"]
    }),
    p("gap", "Gap", { placeholder: gap })
  ]
});

const BUTTON = (size: string): InputPart["groups"] => [
  {
    label: "Size and color",
    props: [
      p("width", "Width"),
      p("height", "Height"),
      p("font-size", "Size", { placeholder: size }),
      p("color", "Color"),
      p("background-color", "Background"),
      p("opacity", "Opacity")
    ]
  },
  {
    label: "Border",
    props: [
      p("border-width", "Border width"),
      p("border-style", "Border style", { options: ["solid", "dashed", "dotted", "none"] }),
      p("border-color", "Border color"),
      p("border-radius", "Radius")
    ]
  },
  { label: "Spacing and position", props: [...SPACING.props, ORDER] }
];

const valuePart: InputPart = {
  id: "selvalue",
  label: "Selected value",
  about: "The chosen option shown in the closed field (a single choice, or several as plain text).",
  selector: "[data-nxt-value]",
  states: ["default", "disabled"],
  groups: [TEXT, { label: "Layout", props: [p("flex-grow", "Grow"), ORDER] }, SPACING]
};

const emptyPart: InputPart = {
  id: "selempty",
  label: "Placeholder",
  about: "The words shown while nothing is chosen.",
  selector: "[data-nxt-placeholder]",
  states: ["default", "disabled"],
  groups: [
    {
      label: "Text",
      props: [
        p("color", "Color"),
        p("font-size", "Size"),
        p("font-weight", "Weight", { options: ["400", "500", "600", "700"] }),
        p("font-style", "Style", { options: ["normal", "italic"] }),
        p("opacity", "Opacity", { placeholder: "1" })
      ]
    }
  ]
};

const chipsPart: InputPart = {
  id: "chips",
  label: "Chips row",
  about: "The row that holds the chosen options when several can be chosen and Show as is Chips.",
  selector: "[data-nxt-values]",
  states: ["default"],
  groups: [FLEX("6px"), SIZE(), SPACING]
};

const chipPart: InputPart = {
  id: "chip",
  label: "Chip",
  about: "One chosen option shown as a chip.",
  selector: "[data-nxt-chip]",
  states: ["default", "hover"],
  stateTails: repeatedStates("[data-nxt-chip]", { hover: ":where(:hover)" }),
  groups: [
    TEXT,
    SPACING,
    BORDER,
    { label: "Layout", props: [p("gap", "Gap"), p("max-width", "Max width")] }
  ]
};

const chipXPart: InputPart = {
  id: "chipx",
  label: "Chip remove button",
  about: "The × that removes a chosen option.",
  selector: "[data-nxt-chip-x]",
  states: ["default", "hover", "focus"],
  stateTails: repeatedStates("[data-nxt-chip-x]", {
    hover: ":where(:hover)",
    focus: ":where(:focus-visible)"
  }),
  groups: BUTTON("14px")
};

const moreChipPart: InputPart = {
  id: "chipmore",
  label: "More chip",
  about: "The “+2” chip that stands for chosen options that do not fit.",
  selector: "[data-nxt-more]",
  states: ["default"],
  groups: [TEXT, SPACING, BORDER]
};

const caretPart: InputPart = {
  id: "caret",
  label: "Arrow icon",
  about: "The arrow at the end of the field. The Focus state is the open state, so turn it there.",
  selector: "[data-nxt-caret]",
  states: ["default", "focus", "disabled"],
  groups: [
    {
      label: "Size and color",
      props: [
        p("font-size", "Size", { placeholder: "16px" }),
        p("width", "Width"),
        p("height", "Height"),
        p("color", "Color"),
        p("opacity", "Opacity")
      ]
    },
    { label: "Spacing and position", props: [...SPACING.props, ORDER] },
    {
      label: "Effects",
      props: [
        p("transform", "Transform", { placeholder: "rotate(180deg)" }),
        p("transition", "Transition")
      ]
    }
  ]
};

const menuPart: InputPart = {
  id: "menu",
  label: "Dropdown panel",
  about: "The panel that opens under the field. Its position and the open animation are set here.",
  selector: "[data-nxt-popover]",
  states: ["default"],
  groups: [
    {
      label: "Position",
      props: [
        p("top", "Top", { placeholder: "calc(100% + 6px)" }),
        p("left", "Left", { placeholder: "0" }),
        p("right", "Right"),
        p("z-index", "Stack order", { placeholder: "30" })
      ]
    },
    FLEX("0"),
    SIZE(),
    SPACING,
    BORDER,
    {
      label: "Effects",
      props: [
        p("box-shadow", "Shadow", { placeholder: "0 12px 32px rgba(0,0,0,.18)" }),
        p("opacity", "Opacity"),
        p("transform", "Transform", { placeholder: "translateY(0)" }),
        p("transition", "Transition")
      ]
    }
  ]
};

const searchRowPart: InputPart = {
  id: "srow",
  label: "Search row",
  about: "The strip at the top of the panel that holds the search box.",
  selector: "[data-nxt-search-row]",
  states: ["default"],
  groups: [FLEX("8px"), SPACING, BORDER]
};

const searchPart: InputPart = {
  id: "search",
  label: "Search box",
  about: "Where the visitor types to narrow the options.",
  selector: "[data-nxt-search]",
  states: ["default", "focus"],
  stateTails: repeatedStates("[data-nxt-search]", { focus: ":where(:focus)" }),
  groups: [
    TEXT,
    SIZE(),
    SPACING,
    BORDER,
    { label: "Other", props: [p("caret-color", "Caret color")] }
  ]
};

const searchHintPart: InputPart = {
  id: "searchph",
  label: "Search hint",
  about: "The hint shown while the search box is empty.",
  selector: "[data-nxt-search]::placeholder",
  states: ["default"],
  groups: [
    {
      label: "Text",
      props: [
        p("color", "Color"),
        p("font-size", "Size"),
        p("font-style", "Style", { options: ["normal", "italic"] }),
        p("opacity", "Opacity", { placeholder: "1" })
      ]
    }
  ]
};

const listPart: InputPart = {
  id: "menulist",
  label: "Options list",
  about: "The scrolling box that holds the options. A long list scrolls inside it.",
  selector: "[data-nxt-listbox]",
  states: ["default"],
  groups: [
    FLEX("2px"),
    {
      label: "Scrolling",
      props: [
        p("max-height", "Max height", { placeholder: "15rem" }),
        p("overflow-y", "Overflow", { options: ["auto", "scroll", "hidden", "visible"] })
      ]
    },
    SPACING,
    { label: "Background", props: [p("background-color", "Background")] }
  ]
};

const optionPart = rowPart(
  "opt",
  "Option item",
  `One option row: the check, the icon and the text together. ${EVERY_OPTION} Focus is the option under the keyboard or pointer; Selected is a chosen option.`,
  "",
  [FLEX("10px"), SIZE(), SPACING, BORDER, TEXT, EFFECTS, { label: "Layout", props: [ORDER] }]
);

const markPart = rowPart(
  "optmark",
  "Check box",
  `The box before an option when several can be chosen; with a single choice it is a check mark at the end. ${EVERY_OPTION}`,
  " [data-nxt-mark]",
  [
    {
      label: "Size and shape",
      props: [
        p("width", "Width", { placeholder: "18px" }),
        p("height", "Height", { placeholder: "18px" }),
        p("border-radius", "Radius", { placeholder: "5px" }),
        p("margin", "Margin"),
        ORDER
      ]
    },
    {
      label: "Color and border",
      props: [
        p("background-color", "Background"),
        p("border-width", "Border width", { placeholder: "1.5px" }),
        p("border-style", "Border style", { options: ["solid", "dashed", "dotted", "none"] }),
        p("border-color", "Border color")
      ]
    },
    {
      label: "Effects",
      props: [
        p("opacity", "Opacity"),
        p("transition", "Transition", { placeholder: "all .15s ease" }),
        p("display", "Display", { options: ["block", "none"] })
      ]
    }
  ]
);

const tickPart = rowPart(
  "opttick",
  "Check mark",
  "The tick drawn inside the check box (or alone at the end of a single choice) when an option is chosen.",
  " [data-nxt-mark]::after",
  [
    {
      label: "Color",
      props: [p("border-color", "Tick color"), p("opacity", "Opacity")]
    },
    {
      label: "Size and position",
      props: [
        p("width", "Width"),
        p("height", "Height"),
        p("left", "Left"),
        p("top", "Top"),
        p("border-width", "Tick thickness", { placeholder: "0 2px 2px 0" }),
        p("transform", "Transform", { placeholder: "rotate(45deg)" })
      ]
    }
  ]
);

const textPart = rowPart(
  "opttext",
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
  "optsub",
  "Option subtext",
  `The smaller line under the label of an option. ${EVERY_OPTION}`,
  " [data-nxt-sub]",
  [TEXT, SPACING]
);

const icoPart = rowPart(
  "optico",
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

const noneMessagePart: InputPart = {
  id: "selnone",
  label: "No results message",
  about: "Shown in the panel when the search matches no option.",
  selector: "[data-nxt-empty]:not([hidden])",
  states: ["default"],
  groups: [
    TEXT,
    {
      label: "Layout",
      props: [p("display", "Display", { options: ["block", "flex", "none"] }), ORDER]
    },
    SPACING,
    { label: "Background", props: [p("background-color", "Background")] }
  ]
};

const shared = (id: string): InputPart => {
  const part = INPUT_PARTS.find((item) => item.id === id);
  if (!part) throw new Error(`Form design part "${id}" is missing`);
  return part;
};

/** Parts only the Select has. */
export const SELECT_PARTS: readonly InputPart[] = [
  valuePart,
  emptyPart,
  chipsPart,
  chipPart,
  chipXPart,
  moreChipPart,
  caretPart,
  menuPart,
  searchRowPart,
  searchPart,
  searchHintPart,
  listPart,
  optionPart,
  markPart,
  tickPart,
  textPart,
  subPart,
  icoPart,
  noneMessagePart
];

/** The parts of a Select, in panel order. */
export const SELECT_PANEL_PARTS: readonly InputPart[] = [
  shared("field"),
  shared("label"),
  shared("required"),
  shared("box"),
  shared("icon"),
  valuePart,
  emptyPart,
  chipsPart,
  chipPart,
  chipXPart,
  moreChipPart,
  shared("clear"),
  caretPart,
  menuPart,
  searchRowPart,
  searchPart,
  searchHintPart,
  listPart,
  optionPart,
  markPart,
  tickPart,
  textPart,
  subPart,
  icoPart,
  noneMessagePart,
  shared("help"),
  shared("error"),
  shared("success")
];
