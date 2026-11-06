// Reads and writes CSS function lists such as `blur(4px) brightness(1.2)` or
// `translateX(10px) rotate(5deg)`. The Transform and Filter editors change only the functions they
// know; anything else in the list (matrix(), var(), drop-shadow() ...) is kept in place.

export interface CssCall {
  name: string;
  args: string;
}

const CALL = /\s*([a-zA-Z][\w-]*)\(/y;

/** The functions in a value, in order. Empty for none/empty; null when the text is not a plain list of calls. */
export function parseCalls(value: string | undefined): CssCall[] | null {
  const text = (value ?? "").trim();
  if (text === "" || text === "none") return [];
  const calls: CssCall[] = [];
  let index = 0;
  while (index < text.length) {
    CALL.lastIndex = index;
    const match = CALL.exec(text);
    if (!match || match[1] === undefined) return null;
    let depth = 1;
    let end = CALL.lastIndex;
    while (end < text.length && depth > 0) {
      const ch = text[end];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      end += 1;
    }
    if (depth !== 0) return null;
    calls.push({ name: match[1], args: text.slice(CALL.lastIndex, end - 1).trim() });
    index = end;
    while (index < text.length && /\s/.test(text[index] ?? "")) index += 1;
  }
  return calls;
}

/** The value for a list of calls; null (property removed) when the list is empty. */
export function serializeCalls(calls: readonly CssCall[]): string | null {
  return calls.length === 0 ? null : calls.map((c) => `${c.name}(${c.args})`).join(" ");
}

/** The arguments of the first call called `name`, or undefined. */
export function callArgs(calls: readonly CssCall[], name: string): string | undefined {
  return calls.find((c) => c.name === name)?.args;
}

/** Sets, replaces or (args null) removes the call `name`. A new call goes to the end. */
export function withCall(calls: readonly CssCall[], name: string, args: string | null): CssCall[] {
  const index = calls.findIndex((c) => c.name === name);
  if (args === null) return calls.filter((c) => c.name !== name);
  if (index === -1) return [...calls, { name, args }];
  return calls.map((c, i) => (i === index ? { name, args } : c));
}

export interface CallField {
  name: string;
  label: string;
  /** Unit written after the number; empty for plain numbers. */
  unit: string;
  min: number;
  max: number;
  step: number;
  /** The value that does nothing: the call is dropped when the field returns to it. */
  neutral: number;
  /** CSS background for the slider track: the colors or shades the control moves through. */
  track: string;
}

export const FILTER_FIELDS: readonly CallField[] = [
  {
    name: "blur",
    label: "Blur",
    unit: "px",
    min: 0,
    max: 40,
    step: 0.5,
    neutral: 0,
    track: "linear-gradient(90deg,#e4e4e7,#a1a1aa 60%,#52525b)"
  },
  {
    name: "brightness",
    label: "Brightness",
    unit: "",
    min: 0,
    max: 3,
    step: 0.05,
    neutral: 1,
    track: "linear-gradient(90deg,#000,#fff)"
  },
  {
    name: "contrast",
    label: "Contrast",
    unit: "",
    min: 0,
    max: 3,
    step: 0.05,
    neutral: 1,
    track: "linear-gradient(90deg,#8c8c8c,#303030 60%,#000)"
  },
  {
    name: "hue-rotate",
    label: "Hue",
    unit: "deg",
    min: 0,
    max: 360,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
  },
  {
    name: "invert",
    label: "Invert",
    unit: "",
    min: 0,
    max: 1,
    step: 0.05,
    neutral: 0,
    track: "linear-gradient(90deg,#fff,#000)"
  },
  {
    name: "opacity",
    label: "Opacity",
    unit: "",
    min: 0,
    max: 1,
    step: 0.05,
    neutral: 1,
    track:
      "linear-gradient(90deg,transparent,#52525b),conic-gradient(#d4d4d8 25%,#fff 0 50%,#d4d4d8 0 75%,#fff 0) 0 0/8px 8px"
  },
  {
    name: "saturate",
    label: "Saturation",
    unit: "",
    min: 0,
    max: 3,
    step: 0.05,
    neutral: 1,
    track: "linear-gradient(90deg,#808080,#3b82f6,#ec4899)"
  },
  {
    name: "sepia",
    label: "Sepia",
    unit: "",
    min: 0,
    max: 1,
    step: 0.05,
    neutral: 0,
    track: "linear-gradient(90deg,#d4d4d8,#704214)"
  }
];

export const TRANSFORM_FIELDS: readonly CallField[] = [
  {
    name: "translateX",
    label: "Translate X",
    unit: "px",
    min: -500,
    max: 500,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#3b82f6,#e4e4e7 50%,#f97316)"
  },
  {
    name: "translateY",
    label: "Translate Y",
    unit: "px",
    min: -500,
    max: 500,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#3b82f6,#e4e4e7 50%,#f97316)"
  },
  {
    name: "translateZ",
    label: "Translate Z",
    unit: "px",
    min: -500,
    max: 500,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#3b82f6,#e4e4e7 50%,#f97316)"
  },
  {
    name: "scale",
    label: "Scale",
    unit: "",
    min: 0,
    max: 3,
    step: 0.05,
    neutral: 1,
    track: "linear-gradient(90deg,#e4e4e7,#22c55e)"
  },
  {
    name: "rotate",
    label: "Rotate",
    unit: "deg",
    min: -360,
    max: 360,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#8b5cf6,#e4e4e7 50%,#ec4899)"
  },
  {
    name: "rotateX",
    label: "Rotate X",
    unit: "deg",
    min: -360,
    max: 360,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#8b5cf6,#e4e4e7 50%,#ec4899)"
  },
  {
    name: "rotateY",
    label: "Rotate Y",
    unit: "deg",
    min: -360,
    max: 360,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#8b5cf6,#e4e4e7 50%,#ec4899)"
  },
  {
    name: "skewX",
    label: "Skew X",
    unit: "deg",
    min: -90,
    max: 90,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#14b8a6,#e4e4e7 50%,#eab308)"
  },
  {
    name: "skewY",
    label: "Skew Y",
    unit: "deg",
    min: -90,
    max: 90,
    step: 1,
    neutral: 0,
    track: "linear-gradient(90deg,#14b8a6,#e4e4e7 50%,#eab308)"
  },
  {
    name: "perspective",
    label: "Perspective",
    unit: "px",
    min: 0,
    max: 2000,
    step: 10,
    neutral: 0,
    track: "linear-gradient(90deg,#e4e4e7,#0ea5e9)"
  }
];

/** The number a call holds for a field, or null when it is not a plain number with the field's unit. */
export function readField(calls: readonly CssCall[], field: CallField): number | null {
  const args = callArgs(calls, field.name);
  if (args === undefined) return null;
  const match = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i.exec(args);
  if (!match || match[2] !== field.unit) return null;
  return Number(match[1]);
}

/** Writes a field: the neutral value removes the call (perspective 0 means none). */
export function writeField(
  calls: readonly CssCall[],
  field: CallField,
  value: number | null
): CssCall[] {
  if (value === null || !Number.isFinite(value) || value === field.neutral) {
    return withCall(calls, field.name, null);
  }
  return withCall(calls, field.name, `${Math.round(value * 1000) / 1000}${field.unit}`);
}
