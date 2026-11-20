import {
  conditionalValueSchema,
  countConditions,
  dynamicTextOf,
  isConditionGroup,
  isConditionalValue,
  MAX_CONDITIONAL_CASES,
  patternProblem,
  VALUELESS_CONDITION_OPS,
  type Condition,
  type ConditionGroup,
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

const ELEMENT_OPS: readonly string[] = ["has", "notHas"];

/** The first thing wrong with a condition group, or null when it is complete and safe. */
function groupProblem(group: ConditionGroup): string | null {
  if (group.items.length === 0) return "Add at least one condition to every case.";
  for (const item of group.items) {
    const problem = isConditionGroup(item) ? groupProblem(item) : conditionProblem(item);
    if (problem) return problem;
  }
  return null;
}

function conditionProblem(c: Condition): string | null {
  if (c.left.trim() === "")
    return c.kind === "value"
      ? "Fill in the Value of every condition."
      : "Fill in the name every condition checks.";
  if (ELEMENT_OPS.includes(c.op)) return null;
  if (!VALUELESS_CONDITION_OPS.includes(c.op as never) && c.right.trim() === "")
    return "Fill in Compare with in every condition.";
  if (c.op === "matches") return patternProblem(c.right);
  return null;
}

/**
 * Why a conditional value cannot be saved yet, or null when it is safe: it needs at least one
 * case, every condition complete (a pattern that cannot run is refused), case values that fit the
 * prop (a select value must be one of its options) and the limits of the schema. Anything else
 * could leave the page with a value it cannot draw.
 */
export function conditionalProblem(
  value: ConditionalValue,
  kind: ValueKind,
  options: readonly { value: string }[]
): string | null {
  if (value.cases.length === 0) return "Add a case with a condition to save.";
  for (const c of value.cases) {
    const problem = groupProblem(c.if);
    if (problem) return problem;
  }
  if (kind === "select") {
    const fits = (v: PlainValue) => options.some((o) => o.value === dynamicTextOf(v));
    if (!value.cases.every((c) => fits(c.then)) || !fits(value.otherwise))
      return "Choose a value for every case and for Else.";
  }
  return conditionalValueSchema.safeParse(value).success ? null : "Too many conditions or levels.";
}
