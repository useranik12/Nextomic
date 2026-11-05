import { z } from "zod";

// Builder UI's own color mode (user setting, Settings > Appearance).
// Not to be confused with a built site's color modes (see docs/templates-and-themes.md).
export const colorModeSchema = z.enum(["dark", "light", "system"]);
export type ColorMode = z.infer<typeof colorModeSchema>;

export const userPreferencesSchema = z.object({
  userId: z.string(),
  colorMode: colorModeSchema.default("dark")
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
