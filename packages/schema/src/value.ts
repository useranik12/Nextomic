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
