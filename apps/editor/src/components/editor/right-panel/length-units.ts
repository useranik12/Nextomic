// Which units and words a CSS property accepts. The Design tab uses this so a user types only the
// number and picks a unit; text such as calc() or min(1440px, 92%) goes in the Custom mode.

export interface UnitSpec {
  /** Units after the number, in the order they are offered. */
  units: readonly string[];
  /** Words the property takes instead of a number (`auto`, `none`, `fit-content`). */
  keywords: readonly string[];
  /** True when a bare number is a valid value (line-height 1.5, opacity 0.5, z-index 2). */
  unitless: boolean;
  /** True when the number may be negative. */
  negative: boolean;
}

export const LENGTH_UNITS = [
  "px",
  "rem",
  "em",
  "%",
  "vw",
  "vh",
  "dvh",
  "svh",
  "lvh",
  "vmin",
  "vmax",
  "ch"
] as const;
const TEXT_UNITS = ["px", "rem", "em"] as const;
const SIZE_WORDS = ["auto", "fit-content", "min-content", "max-content"] as const;

const NUMBER_ONLY = new Set(["flex-grow", "flex-shrink", "order", "z-index", "opacity"]);
const NEGATIVE_OK =
  /^(margin(-[a-z]+)?|top|right|bottom|left|inset|letter-spacing|word-spacing|text-indent|order|z-index|translate|outline-offset)$/;

/** The accepted units for a length or number property; null for properties that are not numeric. */
export function unitSpecFor(property: string): UnitSpec | null {
  const negative = NEGATIVE_OK.test(property);
  if (NUMBER_ONLY.has(property)) {
    return {
      units: [],
      keywords: property === "z-index" ? ["auto"] : [],
      unitless: true,
      negative
    };
  }
  if (property === "line-height") {
    return { units: ["px", "rem", "em", "%"], keywords: ["normal"], unitless: true, negative };
  }
  if (property === "letter-spacing" || property === "word-spacing") {
    return { units: TEXT_UNITS, keywords: ["normal"], unitless: false, negative };
  }
  if (/^(gap|row-gap|column-gap)$/.test(property)) {
    return { units: LENGTH_UNITS, keywords: ["normal"], unitless: false, negative };
  }
  if (/^(width|height|flex-basis|min-width|min-height)$/.test(property)) {
    return { units: LENGTH_UNITS, keywords: SIZE_WORDS, unitless: false, negative };
  }
  if (/^(max-width|max-height)$/.test(property)) {
    return {
      units: LENGTH_UNITS,
      keywords: ["none", "fit-content", "min-content", "max-content"],
      unitless: false,
      negative
    };
  }
  if (/^(margin(-[a-z]+)?|top|right|bottom|left|inset)$/.test(property)) {
    return { units: LENGTH_UNITS, keywords: ["auto"], unitless: false, negative };
  }
  if (
    /^(padding(-[a-z]+)?|font-size|text-indent|border(-[a-z]+)*-(width|radius)|border-radius|outline-(width|offset)|translate|perspective)$/.test(
      property
    )
  ) {
    return { units: LENGTH_UNITS, keywords: [], unitless: false, negative };
  }
  return null;
}

const NUMBER = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;

/** The number and unit of a plain value such as `1.5rem`; null for words, calc() and variables. */
export function parseLength(value: string | undefined): { amount: string; unit: string } | null {
  const m = NUMBER.exec(value?.trim() ?? "");
  return m ? { amount: m[1] ?? "", unit: m[2] ?? "" } : null;
}

export type LengthMode = "empty" | "number" | "keyword" | "custom";

/** What a stored value is, for this property: a number with a known unit, a keyword, or custom text. */
export function lengthMode(
  value: string | undefined,
  spec: UnitSpec
): { mode: LengthMode; amount: string; unit: string } {
  const text = value?.trim() ?? "";
  if (text === "") return { mode: "empty", amount: "", unit: "" };
  if (spec.keywords.includes(text)) return { mode: "keyword", amount: "", unit: text };
  const parsed = parseLength(text);
  if (parsed) {
    const knownUnit = parsed.unit === "" ? spec.unitless : spec.units.includes(parsed.unit);
    // A bare 0 is valid for every length.
    if (knownUnit || (parsed.unit === "" && Number(parsed.amount) === 0)) {
      return { mode: "number", amount: parsed.amount, unit: parsed.unit };
    }
  }
  return { mode: "custom", amount: "", unit: "" };
}

/** True when `text` can be kept in the number box (a partly typed number is fine). */
export function isNumberText(text: string, spec: UnitSpec): boolean {
  return (spec.negative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/).test(text);
}
