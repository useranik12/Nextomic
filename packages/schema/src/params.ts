import { z } from "zod";
import { stateTypeSchema } from "./state";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A parameter of a page or template. A required one must be passed by every Navigate To or Show
 * action, and still needs a default value: the editor and preview show it.
 */
export const pageParamSchema = z
  .object({
    name: z.string().regex(IDENTIFIER).max(64),
    type: stateTypeSchema.default("string"),
    required: z.boolean().default(false),
    defaultValue: z.string().max(500).default("")
  })
  .refine((p) => !p.required || p.defaultValue.trim() !== "", {
    message: "A required parameter needs a default value.",
    path: ["defaultValue"]
  });
export type PageParam = z.infer<typeof pageParamSchema>;

/** Problems of a parameter list, by parameter name (shown under each one in the editor). */
export function paramProblems(params: readonly PageParam[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of params) {
    if (p.required && p.defaultValue.trim() === "")
      out[p.name] = "A required parameter needs a default value.";
  }
  return out;
}
