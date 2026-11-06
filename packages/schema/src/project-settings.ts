import { z } from "zod";
import { DEFAULT_BREAKPOINTS, breakpointListSchema } from "./breakpoint";
import { CLASS_NAME_PATTERN } from "./element";
import { fontListSchema } from "./fonts";
import { styleMapSchema } from "./style";
import { mainFramework } from "./main-framework";
import { newTheme, themeListSchema } from "./theme";
import { variableListSchema } from "./variables";

export const projectSettingsSchema = z.object({
  breakpoints: breakpointListSchema.default(DEFAULT_BREAKPOINTS),
  generateElementIds: z.boolean().default(true),
  // Styles of each class, shared by every element that carries it. Keyed by class name.
  classes: z.record(z.string().regex(CLASS_NAME_PATTERN).max(64), styleMapSchema).default({}),
  // Design system variables, written to the output as --nxt-* custom properties.
  variables: variableListSchema.default([]),
  // Themes: the default one applies everywhere unless a page forces another or conditions match.
  themes: themeListSchema.default([]),
  // Text fonts: files in storage, written to the output as @font-face while active.
  fonts: fontListSchema.default([])
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

/** The Main theme, running on the Main framework, that every new project starts with. */
export const mainTheme = () => ({
  ...newTheme("theme-main", "Main", []),
  framework: mainFramework()
});

export const defaultProjectSettings = (): ProjectSettings => ({
  breakpoints: DEFAULT_BREAKPOINTS.map((b) => ({ ...b })),
  generateElementIds: true,
  classes: {},
  variables: [],
  themes: [mainTheme()],
  fonts: []
});
