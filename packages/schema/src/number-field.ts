import type { ElementNode } from "./element";

// Number fields (elements.md "Forms"): the Count Controller and the Range slider hold one number,
// kept as text like every field value. The renderer (starting state, button limits) and the runtime
// (buttons, keys, writes from actions) share the rules below, so both always agree on what a
// legal value is. A number field is never empty: a missing or unreadable value becomes the minimum
// (else 0) and every value is held inside the limits and rounded to the decimals of the step.

export const COUNTER_TYPE = "counter";
export const RANGE_TYPE = "rangeSlider";
export const NUMBER_FIELD_TYPES = [COUNTER_TYPE, RANGE_TYPE] as const;
export const isNumberField = (type: string): boolean =>
  (NUMBER_FIELD_TYPES as readonly string[]).includes(type);

export interface NumberSpec {
  min: number | null;
  max: number | null;
  step: number;
  /** The value the field starts with, already held inside the limits. */
  start: number;
}

/** A finite number from text, or null for empty or unreadable text. */
export function numberFromText(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** How many decimals a number is written with (1.25 has two). */
export function decimalsOf(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const text = String(n);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.split(".")[1]?.length ?? 0;
}

/** Rounds away binary noise (0.1 + 0.2) to the given decimals. */
export const roundTo = (n: number, decimals: number): number =>
  Number(n.toFixed(Math.min(decimals, 12)));

/** The text of a number as the field holds it. */
export const numberText = (n: number): string => String(n);

/**
 * The rules of one field from its props (`get` reads a prop as resolved text). The step must be
 * above zero (else 1); limits that are not numbers are open. When the limits cross, the minimum
 * wins and the maximum is dropped, so the field is still usable while the problem is shown.
 */
export function numberSpecOf(get: (key: string) => string): NumberSpec {
  const step = numberFromText(get("step"));
  const min = numberFromText(get("min"));
  let max = numberFromText(get("max"));
  if (min !== null && max !== null && max < min) max = null;
  const spec: NumberSpec = { min, max, step: step !== null && step > 0 ? step : 1, start: 0 };
  spec.start = holdNumber(numberFromText(get("value")), spec);
  return spec;
}

/** The decimals every value of the field is rounded to. */
export const specDecimals = (spec: NumberSpec): number =>
  Math.max(decimalsOf(spec.step), decimalsOf(spec.min ?? 0));

/** A value inside the limits and rounded; null or unreadable becomes the minimum, else 0. */
export function holdNumber(value: number | null, spec: NumberSpec): number {
  let n = value ?? spec.min ?? 0;
  if (spec.min !== null && n < spec.min) n = spec.min;
  if (spec.max !== null && n > spec.max) n = spec.max;
  return roundTo(n, Math.max(specDecimals(spec), decimalsOf(n)));
}

/** The value after `times` steps up (positive) or down (negative), held inside the limits. */
export const stepNumber = (value: number, spec: NumberSpec, times: number): number =>
  holdNumber(roundTo(value + spec.step * times, specDecimals(spec) + 2), spec);

/** The Int or Float type the field's value has in dynamic data. */
export function numberTypeOf(get: (key: string) => string): "int" | "float" {
  const spec = numberSpecOf(get);
  return [spec.step, spec.min ?? 0, spec.max ?? 0, spec.start].every(Number.isInteger)
    ? "int"
    : "float";
}

const plain = (node: ElementNode, key: string): string | null => {
  const v = node.props[key];
  if (typeof v === "string") return v;
  return typeof v === "number" ? String(v) : v === undefined ? "" : null;
};

/** One sentence for each setting of a number field that cannot work (settings with tags are skipped). */
export function numberFieldProblems(node: ElementNode): string[] {
  const name = plain(node, "name") || node.type;
  const problems: string[] = [];
  const read = (key: string) => plain(node, key);
  for (const key of ["step", "min", "max", "value"]) {
    const text = read(key);
    if (text && numberFromText(text) === null) problems.push(`"${name}": ${key} must be a number.`);
  }
  const step = read("step");
  if (step && numberFromText(step) !== null && Number(step) <= 0)
    problems.push(`"${name}": the step must be above zero.`);
  const min = numberFromText(read("min") ?? "");
  const max = numberFromText(read("max") ?? "");
  if (min !== null && max !== null && max < min)
    problems.push(`"${name}": the maximum cannot be below the minimum.`);
  if (node.type === RANGE_TYPE && (min === null || max === null))
    problems.push(`"${name}": a range slider needs a minimum and a maximum.`);
  return problems;
}
