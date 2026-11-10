import type { ParamField } from "./fields";

// Triggers that start an action flow (docs/dynamic-data-and-actions.md section 8.2). The owner's
// list in `blueprint/action-flow-sytem.md` is the base: every listed trigger exists here. Triggers
// of elements that are not built yet stay listed with a `disabled` reason.

/** Who owns a flow: an element, or the root of a page or template (like a FlutterFlow scaffold). */
export type FlowOwner = "element" | "page" | "template";

export interface TriggerDef {
  id: string;
  label: string;
  /** Group heading in the trigger picker. */
  group: string;
  /** `common`: every element and roots; `root`: page and template roots; `element`: listed types. */
  scope: "common" | "root" | "element";
  elementTypes?: readonly string[];
  /** Label on a page or template root, when it differs ("When Page Loaded"). */
  rootLabel?: string;
  description?: string;
  fields?: readonly ParamField[];
  disabled?: string;
}

const HOLD_FIELDS: readonly ParamField[] = [
  {
    key: "holdMs",
    label: "Hold time (ms)",
    kind: "number",
    default: "500",
    min: 100,
    max: 10_000,
    required: true
  }
];

const VIEWPORT_FIELDS: readonly ParamField[] = [
  {
    key: "amount",
    label: "Visible amount (%)",
    kind: "number",
    default: "0",
    min: 0,
    max: 100,
    help: "How much of the element must be on screen; 0 means any part."
  },
  {
    key: "margin",
    label: "Viewport margin",
    kind: "text",
    default: "0px",
    help: "Grows or shrinks the viewport edges, like 0px or -10% 0px."
  },
  {
    key: "repeat",
    label: "Run",
    kind: "select",
    default: "once",
    options: [
      { value: "once", label: "Once" },
      { value: "every", label: "Every time" }
    ]
  }
];

const POSITION_FIELDS: readonly ParamField[] = [
  {
    key: "edge",
    label: "Element edge",
    kind: "select",
    default: "top",
    options: [
      { value: "top", label: "Top" },
      { value: "center", label: "Center" },
      { value: "bottom", label: "Bottom" }
    ]
  },
  {
    key: "line",
    label: "Viewport line (%)",
    kind: "number",
    default: "40",
    min: 0,
    max: 100,
    required: true,
    help: "Distance of the line from the top of the viewport."
  },
  {
    key: "direction",
    label: "Scroll direction",
    kind: "select",
    default: "any",
    options: [
      { value: "any", label: "Any" },
      { value: "down", label: "Down" },
      { value: "up", label: "Up" }
    ]
  }
];

const PLAYED_FIELDS: readonly ParamField[] = [
  { key: "seconds", label: "Played time (s)", kind: "number", min: 0, required: true }
];

const common = (id: string, label: string, extra: Partial<TriggerDef> = {}): TriggerDef => ({
  id,
  label,
  group: "Common",
  scope: "common",
  ...extra
});

const COMMON_TRIGGERS: readonly TriggerDef[] = [
  common("click", "On Click", {
    description: "A left click, a tap, or Enter/Space when the element has focus."
  }),
  common("doubleClick", "On Double Click", {
    description: "Two quick clicks or taps on the element."
  }),
  common("clickHold", "On Click And Hold", {
    fields: HOLD_FIELDS,
    description: "The pointer is held down on the element for the hold time."
  }),
  common("secondaryClick", "On Secondary Click", {
    description: "Right mouse button or a two-finger trackpad click."
  }),
  common("secondaryDoubleClick", "On Secondary Double Click", {
    description: "Two quick right clicks on the element."
  }),
  common("secondaryClickHold", "On Secondary Click And Hold", {
    fields: HOLD_FIELDS,
    description: "The right mouse button is held down on the element for the hold time."
  }),
  common("pinchStart", "On Pinch Zoom Start", {
    description: "Two fingers start pinching on the element (touch screens)."
  }),
  common("pinchUpdate", "On Pinch Zoom Update", {
    description: "Runs while the pinch changes; the scale is in the trigger data."
  }),
  common("pinchEnd", "On Pinch Zoom End", {
    description: "The fingers leave the screen after a pinch."
  }),
  common("hoverStart", "On Hover Start", {
    description: "The mouse pointer moves onto the element. Never fires on touch screens."
  }),
  common("hoverEnd", "On Hover End", { description: "The mouse pointer leaves the element." }),
  common("focus", "On Focus", {
    description: "The element or a field inside it gets keyboard focus."
  }),
  common("blur", "On Blur", {
    description: "Keyboard focus leaves the element and everything inside it."
  }),
  common("load", "When Content Loaded", {
    rootLabel: "When Loaded",
    description:
      "When the element is in the page: on load, when re-inserted by a condition and for new loop rows."
  }),
  common("enterViewport", "When Comes To Viewport", {
    fields: VIEWPORT_FIELDS,
    description: "The visible amount of the element scrolls into the screen."
  }),
  common("leaveViewport", "When Leaves Viewport", {
    fields: VIEWPORT_FIELDS,
    description: "The element scrolls out of the screen."
  }),
  common("positionUpdated", "When Position Updated", {
    fields: POSITION_FIELDS,
    description: "When an edge of the element crosses a line of the viewport."
  }),
  common("scrollProgress", "On Scroll Progress", {
    description: "While the element scrolls through the viewport (progress from 0 to 1)."
  }),
  common("resized", "When Resized", {
    description: "The element's width or height changes, for example when the window resizes."
  })
];

const root = (id: string, label: string, extra: Partial<TriggerDef> = {}): TriggerDef => ({
  id,
  label,
  group: "Page",
  scope: "root",
  ...extra
});

const ROOT_TRIGGERS: readonly TriggerDef[] = [
  root("keyPress", "On Key Press", {
    description: "A key is pressed anywhere on the page, unless a text field has focus.",
    fields: [
      {
        key: "key",
        label: "Key",
        kind: "text",
        required: true,
        placeholder: "Escape, Enter, k",
        help: "A key name; add modifiers with +, like Ctrl+k."
      }
    ]
  }),
  root("timer", "Timer / Interval", {
    description: "Runs after the time set, and again every interval when Repeat is on.",
    fields: [
      {
        key: "intervalMs",
        label: "Every (ms)",
        kind: "number",
        default: "1000",
        min: 100,
        required: true
      },
      { key: "repeat", label: "Repeat", kind: "boolean", default: "true" }
    ]
  }),
  root("pageLeave", "On Page Leave", {
    description: "The visitor navigates away or closes the tab. Keep these actions short."
  }),
  root("online", "On Online", { description: "The browser gets its internet connection back." }),
  root("offline", "On Offline", { description: "The browser loses its internet connection." })
];

interface ElementGroup {
  group: string;
  types: readonly string[];
  disabled?: string;
  triggers: readonly [string, string, Partial<TriggerDef>?][];
}

const notBuilt = (name: string) => `The ${name} element is not built yet.`;

const MEDIA_TRIGGERS = (noun: string): ElementGroup["triggers"] => [
  ["loaded", `On ${noun} Loaded`],
  ["played", `On ${noun} Played`],
  ["paused", `On ${noun} Paused`],
  ["ended", `On ${noun} Ended`],
  ["stopped", `On ${noun} Stopped`],
  ["playedLength", `On ${noun} Played Length`, { fields: PLAYED_FIELDS }],
  ["seeked", `On ${noun} Seeked`],
  ["loadError", `On ${noun} Load Error`]
];

const ELEMENT_GROUPS: readonly ElementGroup[] = [
  {
    group: "Scrollable element",
    types: ["section", "container"],
    triggers: [
      [
        "pullToRefresh",
        "On Pull To Refresh",
        { description: "Fires only while the element scrolls (overflow scroll or auto)." }
      ]
    ]
  },
  {
    group: "Image",
    types: ["image"],
    triggers: [
      ["loaded", "On Image Loaded", { description: "The image file finished loading." }],
      ["loadError", "On Image Load Error", { description: "The image file could not be loaded." }]
    ]
  },
  {
    group: "Slider",
    types: ["slider"],
    disabled: notBuilt("Slider"),
    triggers: [["swipe", "On Swipe"]]
  },
  {
    group: "Accordion",
    types: ["accordion"],
    disabled: notBuilt("Accordion"),
    triggers: [["expandedChild", "On Expanded Child"]]
  },
  {
    group: "Video Player",
    types: ["video"],
    disabled: notBuilt("Video"),
    triggers: MEDIA_TRIGGERS("Video")
  },
  {
    group: "Audio Player",
    types: ["audio"],
    disabled: notBuilt("Audio"),
    triggers: MEDIA_TRIGGERS("Audio")
  },
  {
    group: "Timer",
    types: ["timer"],
    disabled: notBuilt("Timer"),
    triggers: [
      ["start", "On Timer Start"],
      ["end", "On Timer End"]
    ]
  },
  {
    group: "Table",
    types: ["table"],
    disabled: notBuilt("Table"),
    triggers: [
      ["pageChange", "On Page Change"],
      ["sortChange", "On Sort Change"],
      ["filterChange", "On Filter Change"],
      ["rowsPerPageChange", "On Rows Per Page Change"]
    ]
  },
  {
    group: "Switch",
    types: ["switch"],
    disabled: notBuilt("Switch"),
    triggers: [
      ["on", "On Toggled On"],
      ["off", "On Toggled Off"],
      ["toggle", "On Toggle"]
    ]
  },
  {
    group: "Tabs",
    types: ["tabs"],
    disabled: notBuilt("Tabs"),
    triggers: [["tabChange", "On Tab Change"]]
  },
  {
    group: "Input",
    types: ["input"],
    disabled: notBuilt("Input"),
    triggers: [
      ["submit", "On Submit"],
      ["change", "On Change"],
      ["focusChange", "On Focus Change"]
    ]
  },
  {
    group: "Dropdown, Radio, Choice Chips",
    types: ["dropdown", "radio", "choiceChips"],
    disabled: "The Dropdown, Radio and Choice Chips elements are not built yet.",
    triggers: [["selected", "On Selected"]]
  },
  {
    group: "Checkbox",
    types: ["checkbox"],
    disabled: notBuilt("Checkbox"),
    triggers: [
      ["checked", "On Checked"],
      ["unchecked", "On Unchecked"],
      ["toggle", "On Toggle"]
    ]
  },
  {
    group: "PIN/OTP Field",
    types: ["pinInput"],
    disabled: notBuilt("PIN/OTP"),
    triggers: [
      ["change", "On Change"],
      ["complete", "On Complete", { description: "When every box is filled." }],
      ["focusChange", "On Focus Change"]
    ]
  },
  {
    group: "Range Slider",
    types: ["rangeSlider"],
    disabled: notBuilt("Range Slider"),
    triggers: [["valueChange", "On Value Change"]]
  },
  {
    group: "Rating Bar",
    types: ["rating"],
    disabled: notBuilt("Rating"),
    triggers: [["barSelect", "On Bar Select"]]
  },
  {
    group: "Count Controller",
    types: ["counter"],
    disabled: notBuilt("Count Controller"),
    triggers: [["countChange", "On Count Change"]]
  }
];

const groupPrefix = (g: ElementGroup) => g.types[0] ?? g.group;

const ELEMENT_TRIGGERS: readonly TriggerDef[] = ELEMENT_GROUPS.flatMap((g) =>
  g.triggers.map(([id, label, extra]) => ({
    id: `${groupPrefix(g)}.${id}`,
    label,
    group: g.group,
    scope: "element" as const,
    elementTypes: g.types,
    ...(g.disabled ? { disabled: g.disabled } : {}),
    ...extra
  }))
);

export const TRIGGERS: readonly TriggerDef[] = [
  ...COMMON_TRIGGERS,
  ...ROOT_TRIGGERS,
  ...ELEMENT_TRIGGERS
];

const BY_ID = new Map(TRIGGERS.map((t) => [t.id, t]));

export const getTrigger = (id: string): TriggerDef | undefined => BY_ID.get(id);

/** The page root element type; template roots use it too. */
export const ROOT_ELEMENT_TYPE = "page";

/** Triggers the picker offers to an owner, in display order (disabled ones included). */
export function triggersFor(owner: FlowOwner, elementType: string): TriggerDef[] {
  const isRoot = owner !== "element";
  return TRIGGERS.filter((t) => {
    if (t.scope === "common") return true;
    if (t.scope === "root") return isRoot;
    return !isRoot && (t.elementTypes ?? []).includes(elementType);
  });
}

/** The label shown to an owner ("When Content Loaded" on elements, "When Loaded" on roots). */
export function triggerLabel(trigger: TriggerDef, owner: FlowOwner): string {
  return owner !== "element" && trigger.rootLabel ? trigger.rootLabel : trigger.label;
}

/** Why an owner cannot use a trigger, or null when it can. */
export function triggerProblem(id: string, owner: FlowOwner, elementType: string): string | null {
  const trigger = getTrigger(id);
  if (!trigger) return "Unknown trigger.";
  if (!triggersFor(owner, elementType).includes(trigger)) {
    return `${trigger.label} is not available on this element.`;
  }
  return trigger.disabled ?? null;
}
