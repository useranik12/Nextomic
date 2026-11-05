import { z } from "zod";

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
    .array(z.union([z.string().max(100_000), z.object({ token: z.string().min(1).max(500) })]))
    .min(1)
});
export type MixedText = z.infer<typeof mixedTextSchema>;

export const propValueSchema = z.union([staticValueSchema, mixedTextSchema]);
export type PropValue = z.infer<typeof propValueSchema>;

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

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
  const parts: MixedText["parts"] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ token: match[1] as string });
    last = match.index + match[0].length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return { kind: "mixed", parts };
}
