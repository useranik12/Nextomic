import { DateTime } from "luxon";
import { z } from "zod";
import { runExpression, toText } from "./expression/evaluate";
import { splitTemplate } from "./expression/template";

// Conditional visibility (dynamic-data-and-actions.md §7): every element can carry condition
// groups (AND / OR, nested). A condition compares a value with a compare value; both are text with
// {{ tags }}, so any dynamic data works (state, loop rows, user, params, dates ...). An element
// whose conditions fail is not rendered at all: it is missing from the HTML, the canvas DOM and the
// preview. Hiding by user or role is cosmetic only; data and pages are protected on the server.

export const CONDITION_OPS = [
  "equals",
  "notEquals",
  "greaterThan",
  "lessThan",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
  "isIn",
  "isNotIn",
  "matches"
] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export const CONDITION_OP_LABELS: Record<ConditionOp, string> = {
  equals: "equals",
  notEquals: "does not equal",
  greaterThan: "is greater than",
  lessThan: "is less than",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  isTrue: "is true",
  isFalse: "is false",
  isIn: "is in list",
  isNotIn: "is not in list",
  matches: "matches pattern"
};

/** Operators that need no compare value. */
export const VALUELESS_CONDITION_OPS: readonly ConditionOp[] = [
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse"
];

export const conditionSchema = z.object({
  id: z.string().min(1).max(64),
  /** The value tested, like {{ app.cart.length }}. */
  left: z.string().max(2000).default(""),
  op: z.enum(CONDITION_OPS).default("equals"),
  /** The compare value; a list for "is in list" (comma separated or a JSON array tag). */
  right: z.string().max(2000).default("")
});
export type Condition = z.infer<typeof conditionSchema>;

export interface ConditionGroup {
  id: string;
  match: "all" | "any";
  items: (Condition | ConditionGroup)[];
}

export const MAX_CONDITION_DEPTH = 4;
export const MAX_CONDITIONS = 50;

export const conditionGroupSchema: z.ZodType<ConditionGroup, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    match: z.enum(["all", "any"]).default("all"),
    items: z.array(z.union([conditionGroupSchema, conditionSchema])).max(MAX_CONDITIONS)
  })
);

export const isConditionGroup = (item: Condition | ConditionGroup): item is ConditionGroup =>
  "items" in item;

export function countConditions(group: ConditionGroup): number {
  return group.items.reduce((n, i) => n + (isConditionGroup(i) ? countConditions(i) : 1), 0);
}

export function conditionDepth(group: ConditionGroup): number {
  return 1 + Math.max(0, ...group.items.filter(isConditionGroup).map(conditionDepth));
}

export const visibilitySchema = z.object({
  /** Off keeps the conditions but always shows the element. */
  enabled: z.boolean().default(true),
  group: conditionGroupSchema.refine(
    (g) => conditionDepth(g) <= MAX_CONDITION_DEPTH && countConditions(g) <= MAX_CONDITIONS,
    `At most ${MAX_CONDITIONS} conditions, ${MAX_CONDITION_DEPTH} levels deep.`
  )
});
export type Visibility = z.infer<typeof visibilitySchema>;

/** Reads a stored visibility; the unused pre-release shape (no `group`) reads as none. */
export const storedVisibilitySchema = z.preprocess(
  (v) => (v && typeof v === "object" && "group" in v ? v : undefined),
  visibilitySchema.optional()
);

/** True when the element has conditions that are switched on. */
export const hasConditions = (v: Visibility | undefined): v is Visibility =>
  !!v && v.enabled && countConditions(v.group) > 0;

/**
 * The value of an operand: a lone {{ tag }} keeps its type (a list stays a list, a number stays
 * a number); text mixed with tags becomes text. A tag that fails gives undefined.
 */
export function operandValue(text: string, scope: Record<string, unknown>): unknown {
  const parts = splitTemplate(text);
  const [only] = parts;
  if (parts.length === 1 && only !== undefined && typeof only !== "string") {
    try {
      return runExpression(only.expr, scope);
    } catch {
      return undefined;
    }
  }
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      try {
        return toText(runExpression(part.expr, scope));
      } catch {
        return "";
      }
    })
    .join("");
}

const MAX_PATTERN = 200;
const MAX_TESTED = 10_000;
/** Nested repeats like (a+)+ can take forever on some inputs; such patterns are refused. */
const NESTED_REPEAT = /\([^)]*[+*}][^)]*\)\s*[+*{]/;

export function patternProblem(pattern: string): string | null {
  if (pattern.length > MAX_PATTERN) return `A pattern can have at most ${MAX_PATTERN} characters.`;
  if (NESTED_REPEAT.test(pattern)) return "Repeats inside repeats, like (a+)+, are not allowed.";
  try {
    new RegExp(pattern, "u");
    return null;
  } catch {
    return "This is not a valid pattern.";
  }
}

const isBlank = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !DateTime.isDateTime(v) && Object.keys(v as object).length === 0);

const asText = (v: unknown) => toText(v).trim();

/** A number or a date as a number to compare; null when it is neither. */
function measure(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (DateTime.isDateTime(v)) return v.toMillis();
  const text = asText(v);
  if (text === "") return null;
  const n = Number(text);
  if (Number.isFinite(n)) return n;
  const date = Date.parse(text);
  return Number.isFinite(date) ? date : null;
}

/** Equal: as numbers or dates when either side is one, else as text ignoring case. */
function same(a: unknown, b: unknown): boolean {
  const numeric = (v: unknown) => typeof v === "number" || DateTime.isDateTime(v);
  if (numeric(a) || numeric(b)) {
    const x = measure(a);
    const y = measure(b);
    if (x !== null && y !== null) return x === y;
  }
  return asText(a).toLowerCase() === asText(b).toLowerCase();
}

/** A list operand: an array, a JSON array text, or comma separated text. */
function listOf(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const text = asText(v);
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON: read as comma separated text.
    }
  }
  return text === "" ? [] : text.split(",").map((s) => s.trim());
}

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return ["true", "1", "yes", "on"].includes(asText(v).toLowerCase());
}

/** Whether one condition holds for these operand values. */
export function conditionHolds(op: ConditionOp, left: unknown, right: unknown): boolean {
  const lower = (v: unknown) => asText(v).toLowerCase();
  switch (op) {
    case "isEmpty":
      return isBlank(left);
    case "isNotEmpty":
      return !isBlank(left);
    case "isTrue":
      return truthy(left);
    case "isFalse":
      return !truthy(left);
    case "equals":
      return same(left, right);
    case "notEquals":
      return !same(left, right);
    case "greaterThan":
    case "lessThan": {
      const a = measure(left);
      const b = measure(right);
      if (a === null || b === null) return false;
      return op === "greaterThan" ? a > b : a < b;
    }
    case "contains":
    case "notContains": {
      const found = Array.isArray(left)
        ? left.some((item) => same(item, right))
        : lower(left).includes(lower(right));
      return op === "contains" ? found : !found;
    }
    case "startsWith":
      return lower(left).startsWith(lower(right));
    case "endsWith":
      return lower(left).endsWith(lower(right));
    case "isIn":
      return listOf(right).some((item) => same(left, item));
    case "isNotIn":
      return !listOf(right).some((item) => same(left, item));
    case "matches": {
      const pattern = asText(right);
      if (patternProblem(pattern)) return false;
      return new RegExp(pattern, "u").test(asText(left).slice(0, MAX_TESTED));
    }
  }
}

/** Whether a group holds. An empty group holds. */
export function groupHolds(group: ConditionGroup, read: (text: string) => unknown): boolean {
  if (group.items.length === 0) return true;
  const test = (item: Condition | ConditionGroup): boolean =>
    isConditionGroup(item)
      ? groupHolds(item, read)
      : conditionHolds(
          item.op,
          read(item.left),
          VALUELESS_CONDITION_OPS.includes(item.op) ? undefined : read(item.right)
        );
  return group.match === "all" ? group.items.every(test) : group.items.some(test);
}

/** Whether an element shows: no conditions, conditions off, or conditions that hold. */
export function isVisible(visibility: Visibility | undefined, scope: Record<string, unknown>) {
  if (!hasConditions(visibility)) return true;
  return groupHolds(visibility.group, (text) => operandValue(text, scope));
}

/** Every operand text of a group (for checks, renames and usage). */
export function conditionTexts(group: ConditionGroup): string[] {
  return group.items.flatMap((item) =>
    isConditionGroup(item) ? conditionTexts(item) : [item.left, item.right]
  );
}
