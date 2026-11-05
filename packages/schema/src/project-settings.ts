import { z } from "zod";
import { DEFAULT_BREAKPOINTS, breakpointListSchema } from "./breakpoint";

export const projectSettingsSchema = z.object({
  breakpoints: breakpointListSchema.default(DEFAULT_BREAKPOINTS),
  generateElementIds: z.boolean().default(true)
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const defaultProjectSettings = (): ProjectSettings => ({
  breakpoints: DEFAULT_BREAKPOINTS.map((b) => ({ ...b })),
  generateElementIds: true
});
