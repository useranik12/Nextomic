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
  // Class manager organisation: categories (also empty ones) and per-class category and lock.
  classCategories: z.array(z.string().trim().min(1).max(48)).max(100).default([]),
  classMeta: z
    .record(
      z.string().regex(CLASS_NAME_PATTERN).max(64),
      z.object({
        category: z.string().trim().min(1).max(48).optional(),
        locked: z.boolean().optional()
      })
    )
    .default({}),
  // Variable manager categories (also empty ones); a variable's own category is its `group`.
  variableCategories: z.array(z.string().trim().min(1).max(48)).max(100).default([]),
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
  classCategories: [],
  classMeta: {},
  variableCategories: [],
  variables: [],
  themes: [mainTheme()],
  fonts: []
});
