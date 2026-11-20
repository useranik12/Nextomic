import {
  countConditions,
  dynamicTextOf,
  isConditionalValue,
  MAX_CONDITIONAL_CASES,
  type ConditionalValue,
  type PlainValue,
  type PropValue
} from "@nextomic/schema";

// Helpers of the conditional value editor (docs/dynamic-data-and-actions.md 7b).

export { MAX_CONDITIONAL_CASES };

/** What a prop edits: free text, a choice from a list, or an On / Off switch. */
export type ValueKind = "text" | "select" | "switch";

/** The plain part of a value: a conditional value counts as its Else value. */
export function plainOf(value: PropValue | undefined): PlainValue {
  if (value === undefined) return "";
  return isConditionalValue(value) ? value.otherwise : value;
}

/** A new conditional value with no cases. The written value becomes the Else value. */
export function startConditional(
  current: PropValue | undefined,
  kind: ValueKind
): ConditionalValue {
  const otherwise = plainOf(current);
  return {
    kind: "conditional",
    cases: [],
    otherwise: kind === "switch" ? otherwise === true || otherwise === "true" : otherwise
  };
}

/** The value after "Use a fixed value": the Else value. */
export const fixedValueOf = (value: ConditionalValue): PlainValue => value.otherwise;

/** The number of conditions across every case. */
export const totalConditions = (value: ConditionalValue): number =>
  value.cases.reduce((n, c) => n + countConditions(c.if), 0);

const shown = (value: PlainValue, kind: ValueKind): string => {
  if (kind === "switch") return value === true || value === "true" ? "On" : "Off";
  const text = dynamicTextOf(value);
  return text === "" ? "empty" : text.length > 18 ? `${text.slice(0, 17)}...` : text;
};

/** One line for the field: "If 2 conditions, else Off". */
export function conditionalSummary(value: ConditionalValue, kind: ValueKind): string {
  const n = totalConditions(value);
  const cases = value.cases.length;
  const head =
    cases === 0
      ? "No cases"
      : `If ${n} condition${n === 1 ? "" : "s"}${cases > 1 ? `, ${cases} cases` : ""}`;
  return `${head}, else ${shown(value.otherwise, kind)}`;
}
