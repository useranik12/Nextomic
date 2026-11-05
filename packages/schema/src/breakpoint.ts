import { z } from "zod";

export const BASE_BREAKPOINT_ID = "base";
export const MAX_BREAKPOINTS = 8;

export const BREAKPOINT_ICONS = ["desktop", "laptop", "tablet", "mobile"] as const;
export const breakpointIconSchema = z.enum(BREAKPOINT_ICONS);
export type BreakpointIcon = z.infer<typeof breakpointIconSchema>;

export const breakpointKindSchema = z.enum(["base", "down", "up"]);
export type BreakpointKind = z.infer<typeof breakpointKindSchema>;

// kind: base applies everywhere, "down" is max-width (and below), "up" is min-width (and above).
// width is the media query threshold; previewWidth is the canvas width used in the editor.
export const breakpointDefSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(40),
  icon: breakpointIconSchema,
  kind: breakpointKindSchema,
  width: z.number().int().min(1).max(10000).nullable(),
  previewWidth: z.number().int().min(200).max(10000).optional()
});
export type BreakpointDef = z.infer<typeof breakpointDefSchema>;

export const DEFAULT_BREAKPOINTS: BreakpointDef[] = [
  {
    id: BASE_BREAKPOINT_ID,
    name: "Desktop",
    icon: "desktop",
    kind: "base",
    width: null,
    previewWidth: 1440
  },
  {
    id: "tablet",
    name: "Tablet",
    icon: "tablet",
    kind: "down",
    width: 768,
    previewWidth: 768
  },
  {
    id: "mobile",
    name: "Mobile",
    icon: "mobile",
    kind: "down",
    width: 414,
    previewWidth: 414
  }
];

export function breakpointPreviewWidth(def: BreakpointDef, fallback = 1440): number {
  return def.previewWidth ?? def.width ?? fallback;
}

// Rules from docs/ui-reference.md 4.12: exactly one base (id "base"), max 8, unique names,
// no two breakpoints of the same kind with the same width.
export const breakpointListSchema = z
  .array(breakpointDefSchema)
  .min(1)
  .max(MAX_BREAKPOINTS)
  .superRefine((list, ctx) => {
    const bases = list.filter((b) => b.kind === "base");
    if (bases.length !== 1 || bases[0]?.id !== BASE_BREAKPOINT_ID) {
      ctx.addIssue({
        code: "custom",
        message: `Exactly one base breakpoint with id "${BASE_BREAKPOINT_ID}" is required`
      });
    }
    const ids = new Set<string>();
    const names = new Set<string>();
    const sizes = new Set<string>();
    list.forEach((b, index) => {
      if (ids.has(b.id))
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate id" });
      ids.add(b.id);
      const nameKey = b.name.toLowerCase();
      if (names.has(nameKey)) {
        ctx.addIssue({ code: "custom", path: [index, "name"], message: "Names must be unique" });
      }
      names.add(nameKey);
      if (b.kind === "base") {
        if (b.width !== null) {
          ctx.addIssue({ code: "custom", path: [index, "width"], message: "Base has no width" });
        }
        return;
      }
      if (b.width === null) {
        ctx.addIssue({ code: "custom", path: [index, "width"], message: "Width is required" });
        return;
      }
      const key = `${b.kind}:${b.width}`;
      if (sizes.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "width"],
          message: "Same kind and width already exists"
        });
      }
      sizes.add(key);
    });
  });

// Cascade order for output CSS: base, then "up" ascending, then "down" descending.
export function breakpointCascade(list: readonly BreakpointDef[]): BreakpointDef[] {
  const base = list.filter((b) => b.kind === "base");
  const up = list.filter((b) => b.kind === "up").sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const down = list
    .filter((b) => b.kind === "down")
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return [...base, ...up, ...down];
}
