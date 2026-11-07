import { z } from "zod";
import { splitTemplate } from "./expression/template";

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

export const propValueSchema = z.union([staticValueSchema, mixedTextSchema]);
export type PropValue = z.infer<typeof propValueSchema>;

/** Text for an input: tokens appear as {{token}} so they can be typed, moved and deleted. */
export function dynamicTextOf(value: PropValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  return value.parts
    .map((part) => (typeof part === "string" ? part : `{{${part.token}}}`))
    .join("");
}

/** Inverse of dynamicTextOf: plain text stays a string, text with {{token}} becomes mixed. */
export function parseDynamicText(text: string): PropValue {
  const split = splitTemplate(text);
  if (!split.some((part) => typeof part !== "string")) return text;
  const parts: MixedText["parts"] = split.map((part) =>
    typeof part === "string"
      ? part
      : { token: text.slice(part.start + 2, part.end - 2).slice(0, 5000) || " " }
  );
  return { kind: "mixed", parts };
}
