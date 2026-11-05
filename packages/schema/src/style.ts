import { z } from "zod";

export const pseudoStateSchema = z.enum(["default", "hover", "focus", "active", "disabled"]);
export type PseudoState = z.infer<typeof pseudoStateSchema>;

export const CSS_PROPERTY_PATTERN = /^(--)?[a-z][a-z0-9-]*$/;

// styles.breakpoints[breakpointId][state][cssProperty] = value. Keys are kebab-case CSS property names.
export const styleDeclarationsSchema = z.record(
  z.string().regex(CSS_PROPERTY_PATTERN),
  z.string().max(2000)
);
export type StyleDeclarations = z.infer<typeof styleDeclarationsSchema>;

export const styleMapSchema = z.object({
  raw: z.string().max(100_000).optional(),
  breakpoints: z
    .record(z.string(), z.record(pseudoStateSchema, styleDeclarationsSchema))
    .default({})
});
export type StyleMap = z.infer<typeof styleMapSchema>;

export const emptyStyleMap = (): StyleMap => ({ breakpoints: {} });
