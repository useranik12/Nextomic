import { z } from "zod";
import {
  conditionDepth,
  conditionGroupSchema,
  conditionTexts,
  countConditions,
  elementConditionRefs,
  MAX_CONDITION_DEPTH,
  MAX_CONDITIONS,
  type ConditionGroup
} from "./condition";
import { splitTemplate, tagText } from "./expression/template";

export const staticValueSchema = z.union([
  z.string().max(100_000),
  z.number(),
  z.boolean(),
  z.null()
]);
export type StaticValue = z.infer<typeof staticValueSchema>;

// Static text mixed with dynamic tokens. Token ids are opaque here; the dynamic data phase defines them.
export const mixedTextSchema = z.object({
  kind: z.literal("mixed"),
  parts: z
    .array(z.union([z.string().max(100_000), z.object({ token: z.string().min(1).max(5000) })]))
    .min(1)
});
export type MixedText = z.infer<typeof mixedTextSchema>;

/** A value without conditions: static, or text mixed with dynamic tokens. */
export const plainValueSchema = z.union([staticValueSchema, mixedTextSchema]);
export type PlainValue = z.infer<typeof plainValueSchema>;

export const MAX_CONDITIONAL_CASES = 10;

// Conditional value (dynamic-data-and-actions.md 7b): the prop picks its whole value from
// conditions. Cases are checked top to bottom; the first group that holds wins, else `otherwise`.
export const conditionalCaseSchema = z.object({
  id: z.string().min(1).max(64),
  if: conditionGroupSchema,
  then: plainValueSchema
});
export type ConditionalCase = z.infer<typeof conditionalCaseSchema>;

export const conditionalValueSchema = z
  .object({
    kind: z.literal("conditional"),
    cases: z.array(conditionalCaseSchema).max(MAX_CONDITIONAL_CASES),
    otherwise: plainValueSchema
  })
  .refine(
    (v) =>
      v.cases.every((c) => conditionDepth(c.if) <= MAX_CONDITION_DEPTH) &&
      v.cases.reduce((n, c) => n + countConditions(c.if), 0) <= MAX_CONDITIONS,
    `At most ${MAX_CONDITIONS} conditions across all cases, ${MAX_CONDITION_DEPTH} levels deep.`
  );
export type ConditionalValue = z.infer<typeof conditionalValueSchema>;

export const propValueSchema = z.union([
  staticValueSchema,
  mixedTextSchema,
  conditionalValueSchema
]);
export type PropValue = z.infer<typeof propValueSchema>;

export const isConditionalValue = (value: unknown): value is ConditionalValue =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "conditional";

/**
 * The plain value a conditional value picks. `holds` tells whether a case's group holds; `preview`
 * (editor only) forces case N (0 based) or "else". Anything that is not conditional is returned as is.
 */
export function pickValue(
  value: PropValue | undefined,
  holds: (group: ConditionGroup) => boolean,
  preview?: number | "else"
): PlainValue | undefined {
  if (!isConditionalValue(value)) return value;
  if (preview === "else") return value.otherwise;
  if (typeof preview === "number") return value.cases[preview]?.then ?? value.otherwise;
  for (const c of value.cases) if (holds(c.if)) return c.then;
  return value.otherwise;
}

/** Every condition group of a conditional value (none for any other value). */
export const conditionalGroups = (value: PropValue | undefined): ConditionGroup[] =>
  isConditionalValue(value) ? value.cases.map((c) => c.if) : [];

/** Every operand text and every case value of a conditional value, for checks and usage. */
export function conditionalTexts(value: ConditionalValue): string[] {
  return [
    ...value.cases.flatMap((c) => [...conditionTexts(c.if), dynamicTextOf(c.then)]),
    dynamicTextOf(value.otherwise)
  ];
}

/** The "el.<id>" refs of the class, ID and attribute conditions of a conditional value. */
export const conditionalElementRefs = (value: PropValue | undefined, ownId: string): string[] =>
  conditionalGroups(value).flatMap((g) => elementConditionRefs(g, ownId));

/** Text for an input: tokens appear as {{token}} so they can be typed, moved and deleted. */
export function dynamicTextOf(value: PropValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  if (value.kind === "conditional") return dynamicTextOf(value.otherwise);
  return value.parts
    .map((part) => (typeof part === "string" ? part : tagText(part.token)))
    .join("");
}

/** Inverse of dynamicTextOf: plain text stays a string, text with {{token}} becomes mixed. */
export function parseDynamicText(text: string): PlainValue {
  const split = splitTemplate(text);
  if (!split.some((part) => typeof part !== "string")) return text;
  const parts: MixedText["parts"] = split.map((part) =>
    typeof part === "string"
      ? part
      : { token: text.slice(part.start + 2, part.end - 2).slice(0, 5000) || " " }
  );
  return { kind: "mixed", parts };
}
