import { z } from "zod";
import { propValueSchema } from "./value";

export const conditionOpSchema = z.enum([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "greaterThan",
  "lessThan",
  "isEmpty",
  "isNotEmpty"
]);
export type ConditionOp = z.infer<typeof conditionOpSchema>;

export const conditionSchema = z.object({
  left: propValueSchema,
  op: conditionOpSchema,
  right: propValueSchema.optional()
});
export type Condition = z.infer<typeof conditionSchema>;

export const conditionGroupSchema = z.object({
  match: z.enum(["all", "any"]).default("all"),
  items: z.array(conditionSchema).max(50)
});
export type ConditionGroup = z.infer<typeof conditionGroupSchema>;
