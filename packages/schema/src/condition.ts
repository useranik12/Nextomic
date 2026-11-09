import { DateTime } from "luxon";
import { z } from "zod";
import { runExpression, toText } from "./expression/evaluate";
import { splitTemplate } from "./expression/template";

// Conditional visibility (dynamic-data-and-actions.md §7): every element can carry condition
// groups (AND / OR, nested). A condition compares a value with a compare value; both are text with
// {{ tags }}, so any dynamic data works (state, loop rows, user, params, dates ...). An element
// whose conditions fail is not rendered at all: it is missing from the HTML, the canvas DOM and the
// preview. Hiding by user or role is cosmetic only; data and pages are protected on the server.
// A condition can also check an element (this one or another on the page): whether it has a
// class, an ID, or an attribute (optionally with a value). Useful with actions that add, remove
// or toggle classes, IDs and attributes.

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

/** What a condition tests: a value, or a class, ID or attribute of an element. */
export const CONDITION_KINDS = ["value", "class", "id", "attribute"] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

export const CONDITION_KIND_LABELS: Record<ConditionKind, string> = {
  value: "Value comparison",
  class: "Class",
  id: "ID",
  attribute: "Attribute"
};

/** Operators of the class, ID and attribute kinds. */
export const ELEMENT_CONDITION_OPS = ["has", "notHas"] as const;
export type ElementConditionOp = (typeof ELEMENT_CONDITION_OPS)[number];

export const ELEMENT_CONDITION_OP_LABELS: Record<ElementConditionOp, string> = {
  has: "has",
  notHas: "does not have"
};

const isElementOp = (op: string): op is ElementConditionOp =>
  (ELEMENT_CONDITION_OPS as readonly string[]).includes(op);

export const conditionSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(CONDITION_KINDS).default("value"),
    /** Class, ID and attribute kinds: the element checked (its node id); absent = this element. */
    target: z.string().min(1).max(64).optional(),
    /**
     * Value kind: the value tested, like {{ app.cart.length }}. Other kinds: the class name, the
     * ID or the attribute name.
     */
    left: z.string().max(2000).default(""),
    op: z.enum([...CONDITION_OPS, ...ELEMENT_CONDITION_OPS]).default("equals"),
    /**
     * Value kind: the compare value; a list for "is in list" (comma separated or a JSON array
     * tag). Attribute kind: the attribute value, empty to only check the attribute is there.
     */
    right: z.string().max(2000).default("")
  })
  .refine((c) => (c.kind === "value") !== isElementOp(c.op), {
    message: "This operator does not fit the condition type.",
    path: ["op"]
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

/** What an element outputs: its classes, its ID and its other attributes (names lowercase). */
export interface ElementFacts {
  classes: readonly string[];
  id: string | undefined;
  attributes: Readonly<Record<string, string>>;
}

/** The facts of the element checked (`undefined` = this element); undefined when it is gone. */
export type ElementFactsReader = (target: string | undefined) => ElementFacts | undefined;

/**
 * Whether a class, ID or attribute condition holds. Class names and IDs match exactly (as in
 * CSS); attribute names ignore case, attribute values compare like "equals". A missing element
 * has nothing, so "has" fails and "does not have" holds.
 */
export function elementConditionHolds(
  condition: Condition,
  read: (text: string) => unknown,
  facts: ElementFactsReader | undefined
): boolean {
  const found = (() => {
    const of = facts?.(condition.target);
    const name = asText(read(condition.left));
    if (!of || name === "") return false;
    if (condition.kind === "class") return of.classes.includes(name);
    if (condition.kind === "id") return of.id === name;
    const value = of.attributes[name.toLowerCase()];
    if (value === undefined) return false;
    const wanted = asText(read(condition.right));
    return wanted === "" || same(value, wanted);
  })();
  return condition.op === "notHas" ? !found : found;
}

/** Whether a group holds. An empty group holds. */
export function groupHolds(
  group: ConditionGroup,
  read: (text: string) => unknown,
  facts?: ElementFactsReader
): boolean {
  if (group.items.length === 0) return true;
  const test = (item: Condition | ConditionGroup): boolean => {
    if (isConditionGroup(item)) return groupHolds(item, read, facts);
    if (item.kind !== "value") return elementConditionHolds(item, read, facts);
    if (isElementOp(item.op)) return false;
    return conditionHolds(
      item.op,
      read(item.left),
      VALUELESS_CONDITION_OPS.includes(item.op) ? undefined : read(item.right)
    );
  };
  return group.match === "all" ? group.items.every(test) : group.items.some(test);
}

/** Whether an element shows: no conditions, conditions off, or conditions that hold. */
export function isVisible(
  visibility: Visibility | undefined,
  scope: Record<string, unknown>,
  facts?: ElementFactsReader
) {
  if (!hasConditions(visibility)) return true;
  return groupHolds(visibility.group, (text) => operandValue(text, scope), facts);
}

/** The elements other than the one itself that a group's conditions check (node ids). */
export function conditionTargets(group: ConditionGroup): string[] {
  return group.items.flatMap((item) =>
    isConditionGroup(item) ? conditionTargets(item) : item.target ? [item.target] : []
  );
}

/** Splits list text on commas outside {{ tags }}; blank items are dropped. */
export function splitListText(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const pair = text.slice(i, i + 2);
    if (pair === "{{" || pair === "}}") {
      depth = Math.max(0, depth + (pair === "{{" ? 1 : -1));
      current += pair;
      i += 1;
    } else if (text[i] === "," && depth === 0) {
      items.push(current);
      current = "";
    } else current += text[i];
  }
  items.push(current);
  return items.map((item) => item.trim()).filter((item) => item !== "");
}

/** Every operand text of a group (for checks, renames and usage). */
export function conditionTexts(group: ConditionGroup): string[] {
  return group.items.flatMap((item) =>
    isConditionGroup(item) ? conditionTexts(item) : [item.left, item.right]
  );
}
