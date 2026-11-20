// Form Input design (docs/elements.md "Form Input design"). An Input is several parts (field,
// label, box, text, placeholder, icon, buttons, messages). Each part's style is stored in the
// ordinary style map under the key `--nxt-ip-<part>-<property>[-<state>]` (at the default state of
// the element or class that carries it, per breakpoint). The renderer turns those keys into plain
// declarations on the part's own selector. The table below is the single list of what can be set:
// the editor builds its panel from it and the renderer accepts nothing else.

export const INPUT_DESIGN_PREFIX = "--nxt-ip-";

export const INPUT_STATES = [
  "default",
  "hover",
  "focus",
  "checked",
  "error",
  "success",
  "disabled"
] as const;
export type InputState = (typeof INPUT_STATES)[number];

export const INPUT_STATE_LABELS: Record<InputState, string> = {
  default: "Default",
  hover: "Hover",
  focus: "Focus",
  checked: "Checked",
  error: "Error",
  success: "Success",
  disabled: "Disabled"
};

export interface InputDesignProp {
  /** The CSS property written on the part. */
  prop: string;
  label: string;
  options?: string[];
  placeholder?: string;
  suggestions?: string[];
  /** Plain words about the setting. */
  tip?: string;
}

export interface InputDesignGroup {
  label: string;
  props: InputDesignProp[];
}

/** How a state selects a part: an extra test on the field element and a suffix on the part itself. */
interface StateSelector {
  field: string;
  inner: string;
}

/** One way a state reaches a part: a test on the field element and the rest of the selector below it. */
export interface StateTail {
  field: string;
  tail: string;
}

export interface InputPart {
  id: string;
  label: string;
  /** DesignIcon-free hint of what the part is, shown under the sub-group title. */
  about: string;
  /** Selector of the part inside the field ("" is the field itself). */
  selector: string;
  /** The states this part can be styled in (default is always there). */
  states: InputState[];
  groups: InputDesignGroup[];
  /**
   * Parts that sit on a repeated row (the options of a choice field) say per state how the state
   * reaches them; without it the state is a test on the field (Input parts).
   */
  stateTails?: Partial<Record<InputState, StateTail[]>>;
  /** The element the part selectors start from; `[data-nxt-field]` (a form field) when absent. */
  root?: string;
}

const p = (prop: string, label: string, extra: Partial<InputDesignProp> = {}): InputDesignProp => ({
  prop,
  label,
  ...extra
});

const TEXT: InputDesignGroup = {
  label: "Text",
  props: [
    p("color", "Color"),
    p("font-family", "Font family"),
    p("font-size", "Size", { placeholder: "14px" }),
    p("font-weight", "Weight", {
      options: ["400", "500", "600", "700"]
    }),
    p("font-style", "Style", { options: ["normal", "italic"] }),
    p("line-height", "Line height", { placeholder: "1.4" }),
    p("letter-spacing", "Letter spacing", { placeholder: "0" }),
    p("text-transform", "Case", { options: ["none", "uppercase", "lowercase", "capitalize"] }),
    p("text-align", "Align", { options: ["left", "center", "right"] }),
    p("text-decoration", "Decoration", { options: ["none", "underline", "line-through"] })
  ]
};

const SPACING: InputDesignGroup = {
  label: "Spacing",
  props: [
    p("padding", "Padding", { placeholder: "8px 12px" }),
    p("margin", "Margin", { placeholder: "0" })
  ]
};

const BORDER: InputDesignGroup = {
  label: "Background and border",
  props: [
    p("background-color", "Background"),
    p("border-width", "Border width", { placeholder: "1px" }),
    p("border-style", "Border style", { options: ["solid", "dashed", "dotted", "none"] }),
    p("border-color", "Border color"),
    p("border-radius", "Radius", { placeholder: "8px" })
  ]
};

const EFFECTS: InputDesignGroup = {
  label: "Effects",
  props: [
    p("box-shadow", "Shadow", { placeholder: "0 1px 2px rgba(0,0,0,.1)" }),
    p("opacity", "Opacity", { placeholder: "1" }),
    p("transition", "Transition", { placeholder: "all .15s ease" }),
    p("cursor", "Cursor", { options: ["auto", "pointer", "text", "not-allowed", "default"] })
  ]
};

const SIZE = (...extra: InputDesignProp[]): InputDesignGroup => ({
  label: "Size",
  props: [
    p("width", "Width", { placeholder: "100%" }),
    p("min-width", "Min width"),
    p("max-width", "Max width"),
    p("height", "Height"),
    p("min-height", "Min height"),
    ...extra
  ]
});

const ORDER = p("order", "Position order", {
  placeholder: "0",
  tip: "Parts sit in order from the lowest number. Use -1 to put a part first, a high number to put it last."
});

const MESSAGE_GROUPS: InputDesignGroup[] = [
  TEXT,
  {
    label: "Layout",
    props: [
      p("display", "Display", { options: ["block", "flex", "none"] }),
      p("align-self", "Align self", { options: ["stretch", "flex-start", "center", "flex-end"] }),
      p("width", "Width", { placeholder: "100%" }),
      ORDER
    ]
  },
  SPACING,
  BORDER
];

const BUTTON_GROUPS: InputDesignGroup[] = [
  {
    label: "Size",
    props: [
      p("width", "Width"),
      p("height", "Height"),
      p("font-size", "Text or icon size", { placeholder: "13px" })
    ]
  },
  {
    label: "Color",
    props: [p("color", "Color"), p("background-color", "Background"), p("opacity", "Opacity")]
  },
  {
    label: "Border",
    props: [
      p("border-width", "Border width"),
      p("border-style", "Border style", { options: ["solid", "dashed", "dotted", "none"] }),
      p("border-color", "Border color"),
      p("border-radius", "Radius", { placeholder: "6px" })
    ]
  },
  { label: "Spacing and position", props: [...SPACING.props, ORDER] },
  {
    label: "Text",
    props: [
      p("font-weight", "Weight", { options: ["400", "500", "600", "700"] }),
      p("text-transform", "Case", { options: ["none", "uppercase", "lowercase", "capitalize"] })
    ]
  },
  { label: "Effects", props: [p("box-shadow", "Shadow"), p("transition", "Transition")] }
];

export const INPUT_PARTS: readonly InputPart[] = [
  {
    id: "field",
    label: "Field",
    about: "The whole field: label, box and messages together.",
    selector: "",
    states: ["default", "hover", "focus", "error", "success", "disabled"],
    groups: [
      {
        label: "Layout",
        props: [
          p("display", "Display", { options: ["flex", "block", "grid", "none"] }),
          p("flex-direction", "Label position", {
            options: ["column", "column-reverse", "row", "row-reverse"],
            tip: "Column puts the label above the box, row puts it beside the box."
          }),
          p("flex-wrap", "Wrap", { options: ["wrap", "nowrap"] }),
          p("align-items", "Align items", {
            options: ["stretch", "flex-start", "center", "flex-end", "baseline"]
          }),
          p("justify-content", "Justify", {
            options: ["flex-start", "center", "flex-end", "space-between"]
          }),
          p("gap", "Gap", { placeholder: "6px" })
        ]
      },
      SIZE(),
      SPACING,
      BORDER,
      { label: "Effects", props: [p("box-shadow", "Shadow"), p("opacity", "Opacity")] }
    ]
  },
  {
    id: "label",
    label: "Label",
    about: "The text above or beside the box.",
    selector: "label",
    states: ["default", "focus", "error", "success", "disabled"],
    groups: [
      TEXT,
      {
        label: "Layout",
        props: [p("width", "Width", { placeholder: "120px" }), ORDER]
      },
      SPACING,
      {
        label: "Background",
        props: [p("background-color", "Background"), p("border-radius", "Radius")]
      }
    ]
  },
  {
    id: "required",
    label: "Required marker",
    about: "The star after the label of a required field.",
    selector: "label[data-required]::after",
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
  },
  {
    id: "box",
    label: "Input box",
    about: "The shell around the icon, the text and the buttons.",
    selector: "[data-nxt-box]",
    states: ["default", "hover", "focus", "error", "success", "disabled"],
    groups: [
      {
        label: "Layout",
        props: [
          p("align-items", "Align items", {
            options: ["center", "flex-start", "flex-end", "stretch"]
          }),
          p("gap", "Gap", { placeholder: "8px" }),
          ORDER
        ]
      },
      SIZE(),
      SPACING,
      BORDER,
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
  },
  {
    id: "control",
    label: "Input text",
    about: "What the visitor types.",
    selector: "[data-nxt-control]",
    states: ["default", "focus", "disabled"],
    groups: [
      TEXT,
      SIZE(),
      SPACING,
      {
        label: "Other",
        props: [
          p("background-color", "Background"),
          p("caret-color", "Caret color"),
          p("cursor", "Cursor", { options: ["text", "pointer", "not-allowed", "auto"] }),
          p("resize", "Resize (text area)", {
            options: ["vertical", "horizontal", "both", "none"]
          }),
          p("opacity", "Opacity")
        ]
      }
    ]
  },
  {
    id: "placeholder",
    label: "Placeholder",
    about: "The hint shown while the field is empty.",
    selector: "[data-nxt-control]::placeholder",
    states: ["default", "focus"],
    groups: [
      {
        label: "Text",
        props: [
          p("color", "Color"),
          p("font-size", "Size"),
          p("font-weight", "Weight", { options: ["400", "500", "600", "700"] }),
          p("font-style", "Style", { options: ["normal", "italic"] }),
          p("letter-spacing", "Letter spacing"),
          p("text-transform", "Case", {
            options: ["none", "uppercase", "lowercase", "capitalize"]
          }),
          p("opacity", "Opacity", { placeholder: "1" })
        ]
      }
    ]
  },
  {
    id: "icon",
    label: "Field icon",
    about: "The icon chosen under General > Icons.",
    selector: "[data-nxt-icon]",
    states: ["default", "focus", "error", "success", "disabled"],
    groups: [
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
  },
  {
    id: "clear",
    label: "Clear button",
    about: "The button that empties the field.",
    selector: "[data-nxt-clear]:not([hidden])",
    states: ["default", "hover", "focus"],
    groups: BUTTON_GROUPS
  },
  {
    id: "toggle",
    label: "Show/hide button",
    about: "The password eye button.",
    selector: "[data-nxt-toggle]",
    states: ["default", "hover", "focus"],
    groups: BUTTON_GROUPS
  },
  {
    id: "help",
    label: "Help text",
    about: "The hint under the box.",
    selector: "[data-nxt-help]",
    states: ["default"],
    groups: MESSAGE_GROUPS
  },
  {
    id: "error",
    label: "Error message",
    about: "Shown when the field fails validation.",
    selector: "[data-nxt-error]:not([hidden])",
    states: ["default"],
    groups: MESSAGE_GROUPS
  },
  {
    id: "success",
    label: "Success message",
    about: "Shown when the field passes validation.",
    selector: "[data-nxt-success]:not([hidden])",
    states: ["default"],
    groups: MESSAGE_GROUPS
  }
];

/** How each state finds the field: the forced forms are what the canvas uses to show a state. */
const STATE_SELECTORS: Record<InputState, StateSelector[]> = {
  default: [{ field: "", inner: "" }],
  hover: [
    { field: "", inner: ":hover" },
    { field: '[data-nxt-force="hover"]', inner: "" }
  ],
  focus: [
    { field: ":focus-within", inner: "" },
    { field: '[data-nxt-force="focus"]', inner: "" }
  ],
  error: [
    { field: "[data-invalid]", inner: "" },
    { field: '[data-nxt-force="error"]', inner: "" }
  ],
  success: [
    { field: "[data-valid]", inner: "" },
    { field: '[data-nxt-force="success"]', inner: "" }
  ],
  checked: [
    { field: ":has([data-nxt-control]:checked)", inner: "" },
    { field: '[data-nxt-force="checked"]', inner: "" }
  ],
  disabled: [
    { field: ":has([data-nxt-control]:disabled)", inner: "" },
    { field: '[data-nxt-force="disabled"]', inner: "" }
  ]
};

/** Buttons react to their own hover and keyboard focus, not to the field. */
const BUTTON_STATES: Partial<Record<InputState, StateSelector[]>> = {
  hover: [{ field: "", inner: ":hover" }],
  focus: [{ field: "", inner: ":focus-visible" }]
};

const partOf = (id: string, parts: readonly InputPart[]): InputPart | undefined =>
  parts.find((part) => part.id === id);

/** Pieces the choice-field parts (choice-design.ts) are built from. */
export const DESIGN_KIT = {
  p,
  TEXT,
  SPACING,
  BORDER,
  EFFECTS,
  SIZE,
  ORDER,
  MESSAGE_GROUPS
};

/** The style key of one setting. */
export function inputDesignKey(part: string, prop: string, state: InputState): string {
  return `${INPUT_DESIGN_PREFIX}${part}-${prop}${state === "default" ? "" : `-${state}`}`;
}

export interface ParsedInputKey {
  part: InputPart;
  prop: string;
  state: InputState;
}

/** The part, property and state a style key stands for; null for anything the table does not list. */
export function parseInputDesignKey(
  key: string,
  parts: readonly InputPart[] = INPUT_PARTS
): ParsedInputKey | null {
  if (!key.startsWith(INPUT_DESIGN_PREFIX)) return null;
  const rest = key.slice(INPUT_DESIGN_PREFIX.length);
  const dash = rest.indexOf("-");
  const part = dash > 0 ? partOf(rest.slice(0, dash), parts) : undefined;
  if (!part) return null;
  let prop = rest.slice(dash + 1);
  let state: InputState = "default";
  for (const candidate of INPUT_STATES) {
    if (candidate !== "default" && prop.endsWith(`-${candidate}`)) {
      state = candidate;
      prop = prop.slice(0, -(candidate.length + 1));
      break;
    }
  }
  if (!part.states.includes(state)) return null;
  const listed = part.groups.some((group) => group.props.some((item) => item.prop === prop));
  return listed ? { part, prop, state } : null;
}

/**
 * The selectors that reach `part` in `state` from an owner selector (an element or a class). The
 * owner may be the field itself or anything around it, so both forms are returned.
 */
export function inputPartSelectors(owner: string, part: InputPart, state: InputState): string[] {
  const out: string[] = [];
  const tails = part.stateTails?.[state];
  if (tails) {
    for (const { field, tail } of tails) {
      const compound = `${part.root ?? "[data-nxt-field]"}${field}`;
      out.push(`${owner}${compound}${tail}`, `${owner} ${compound}${tail}`);
    }
    return out;
  }
  const alternatives =
    (part.id === "clear" || part.id === "toggle" ? BUTTON_STATES[state] : undefined) ??
    STATE_SELECTORS[state];
  for (const { field, inner } of alternatives) {
    const compound = `[data-nxt-field]${field}`;
    const tail = part.selector === "" ? inner : ` ${part.selector}${inner}`;
    out.push(`${owner}${compound}${tail}`, `${owner} ${compound}${tail}`);
  }
  return out;
}
