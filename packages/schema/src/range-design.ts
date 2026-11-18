// Design of the Range slider (docs/elements.md "Range slider design"). Same method as the other form
// fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]`. The slider is
// drawn from plain elements (track, fill, thumb, value) laid under a real, invisible range input,
// so the keyboard and screen readers get the native slider and every part can be designed.

import {
  DESIGN_KIT,
  INPUT_PARTS,
  type InputPart,
  type InputState,
  type StateTail
} from "./input-design";
import { forcedState } from "./part-states";

const { p, TEXT, BORDER, SIZE, SPACING } = DESIGN_KIT;

const THUMB = "[data-nxt-thumb]";
const AREA = "[data-nxt-slide]";
const CONTROL = "[data-nxt-control]";

/**
 * The thumb is under an invisible input, so it never gets :hover or :focus itself: hover is the
 * hover of the track area around it, focus is the focus of the input inside that area. Tests sit in
 * :where() and the doubled thumb selector gives a state more weight than the default.
 */
const thumbStates = (): Partial<Record<InputState, StateTail[]>> => {
  const at = (state: InputState, test: string): StateTail[] => [
    { field: "", tail: ` ${AREA}${test} ${THUMB}${THUMB}` },
    { field: forcedState(state), tail: ` ${THUMB}${THUMB}` }
  ];
  const wide = (state: InputState, test: string): StateTail[] => [
    { field: test, tail: ` ${THUMB}${THUMB}` },
    { field: forcedState(state), tail: ` ${THUMB}${THUMB}` }
  ];
  return {
    default: [{ field: "", tail: ` ${THUMB}` }],
    hover: at("hover", ":where(:hover)"),
    focus: at("focus", `:has(:where(${CONTROL}:focus-visible))`),
    error: wide("error", ":where([data-invalid])"),
    success: wide("success", ":where([data-valid])"),
    disabled: wide("disabled", `:where(:has(${CONTROL}:disabled))`)
  };
};

const sliderPart: InputPart = {
  id: "slider",
  label: "Slider row",
  about: "The row that holds the limits, the track and the value.",
  selector: "[data-nxt-range]",
  states: ["default"],
  groups: [
    {
      label: "Layout",
      props: [
        p("display", "Display", { options: ["flex", "grid", "block", "none"] }),
        p("flex-direction", "Direction", { options: ["row", "row-reverse", "column"] }),
        p("align-items", "Align items", {
          options: ["center", "flex-start", "flex-end", "stretch"]
        }),
        p("gap", "Gap", { placeholder: "12px" })
      ]
    },
    { label: "Thumb size", props: [p("--nxt-thumb", "Thumb size", { placeholder: "20px" })] },
    SIZE(),
    SPACING,
    { label: "Effects", props: [p("opacity", "Opacity")] }
  ]
};

const barGroups = [
  {
    label: "Size",
    props: [p("height", "Thickness", { placeholder: "6px" })]
  },
  BORDER,
  {
    label: "Effects",
    props: [p("box-shadow", "Shadow"), p("opacity", "Opacity"), p("transition", "Transition")]
  }
];

const trackPart: InputPart = {
  id: "track",
  label: "Track",
  about: "The line behind the thumb.",
  selector: "[data-nxt-track]",
  states: ["default", "hover", "focus", "error", "success", "disabled"],
  groups: barGroups
};

const fillPart: InputPart = {
  id: "fill",
  label: "Filled part",
  about: "The part of the track between the start and the thumb.",
  selector: "[data-nxt-fill]",
  states: ["default", "hover", "focus", "error", "success", "disabled"],
  groups: barGroups
};

const thumbPart: InputPart = {
  id: "thumb",
  label: "Thumb",
  about: "The handle the visitor drags. Its size is set under Slider row > Thumb size.",
  selector: THUMB,
  states: ["default", "hover", "focus", "error", "success", "disabled"],
  stateTails: thumbStates(),
  groups: [
    BORDER,
    {
      label: "Effects",
      props: [
        p("box-shadow", "Shadow", { placeholder: "0 1px 3px rgba(0,0,0,.3)" }),
        p("opacity", "Opacity"),
        p("transition", "Transition"),
        p("transform", "Transform", { placeholder: "scale(1.1)" })
      ]
    }
  ]
};

const valuePart: InputPart = {
  id: "value",
  label: "Value",
  about: "The number shown above the thumb or at the end of the row.",
  selector: "[data-nxt-value]",
  states: ["default", "error", "success", "disabled"],
  groups: [
    TEXT,
    {
      label: "Background",
      props: [p("background-color", "Background"), p("border-radius", "Radius")]
    },
    SPACING,
    {
      label: "Layout",
      props: [p("min-width", "Min width"), p("order", "Position order")]
    }
  ]
};

const limitsPart: InputPart = {
  id: "limits",
  label: "Min and max labels",
  about: "The smallest and largest value at the two ends.",
  selector: "[data-nxt-limit]",
  states: ["default", "error", "success", "disabled"],
  groups: [TEXT, SPACING]
};

const shared = (id: string): InputPart => {
  const part = INPUT_PARTS.find((item) => item.id === id);
  if (!part) throw new Error(`Form design part "${id}" is missing`);
  return part;
};

/** Parts only the Range slider has. */
export const RANGE_PARTS: readonly InputPart[] = [
  sliderPart,
  trackPart,
  fillPart,
  thumbPart,
  valuePart,
  limitsPart
];

/** The parts of a Range slider, in panel order. */
export const RANGE_PANEL_PARTS: readonly InputPart[] = [
  shared("field"),
  shared("label"),
  ...RANGE_PARTS,
  shared("help"),
  shared("error"),
  shared("success")
];
