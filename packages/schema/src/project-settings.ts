import { z } from "zod";
import { DEFAULT_BREAKPOINTS, breakpointListSchema } from "./breakpoint";
import { CLASS_NAME_PATTERN } from "./element";
import { styleMapSchema } from "./style";
import { variableListSchema } from "./variables";

export const projectSettingsSchema = z.object({
  breakpoints: breakpointListSchema.default(DEFAULT_BREAKPOINTS),
  generateElementIds: z.boolean().default(true),
  // Styles of each class, shared by every element that carries it. Keyed by class name.
  classes: z.record(z.string().regex(CLASS_NAME_PATTERN).max(64), styleMapSchema).default({}),
  // Design system variables, written to the output as --nxt-* custom properties.
  variables: variableListSchema.default([])
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const defaultProjectSettings = (): ProjectSettings => ({
  breakpoints: DEFAULT_BREAKPOINTS.map((b) => ({ ...b })),
  generateElementIds: true,
  classes: {},
  variables: []
});
