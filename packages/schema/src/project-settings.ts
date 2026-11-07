import { emptyTaxonomy, taxonomySchema } from "./taxonomy";
import { z } from "zod";
import { DEFAULT_BREAKPOINTS, breakpointListSchema } from "./breakpoint";
import { animationSettingsSchema, emptyAnimationSettings } from "./animations";
import { cssFileListSchema } from "./css-files";
import { CLASS_NAME_PATTERN } from "./element";
import { fontListSchema } from "./fonts";
import { styleMapSchema } from "./style";
import { mainFramework } from "./main-framework";
import { newTheme, themeListSchema } from "./theme";
import { variableListSchema } from "./variables";
import { appStateListSchema, constantListSchema } from "./state";

export const VERSION_LIMIT_MIN = 5;
export const VERSION_LIMIT_MAX = 200;
export const versionLimitSchema = z.number().int().min(VERSION_LIMIT_MIN).max(VERSION_LIMIT_MAX);

/** How many saved versions a page keeps: its own limit, else the app-wide one, never above the maximum. */
export function effectiveVersionLimit(
  project: Pick<ProjectSettings, "versionLimit">,
  page: { versionLimit?: number | null }
): number {
  return Math.min(page.versionLimit ?? project.versionLimit, VERSION_LIMIT_MAX);
}

export const projectSettingsSchema = z.object({
  breakpoints: breakpointListSchema.default(DEFAULT_BREAKPOINTS),
  generateElementIds: z.boolean().default(true),
  // Hides the selection outline while the Border settings are open, so the border can be judged.
  hideEditBorder: z.boolean().default(false),
  // Shows a running clock in the editor top bar.
  showClock: z.boolean().default(false),
  // Version control: every save keeps a snapshot. Off stops new snapshots (old ones stay).
  versionControl: z.boolean().default(true),
  // App-wide number of snapshots kept per page (a page can set its own); older ones are deleted.
  versionLimit: versionLimitSchema.default(VERSION_LIMIT_MAX),
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
  fonts: fontListSchema.default([]),
  // Custom CSS files: written after the theme and before classes, in this order.
  cssFiles: cssFileListSchema.default([]),
  // Categories and tags of pages and templates (four separate lists).
  taxonomy: taxonomySchema.default(emptyTaxonomy()),
  // Generate a screenshot of each page and template for the grid view in Pages & Templates.
  generateScreenshots: z.boolean().default(false),
  // Animations: GSAP timelines in folders (docs/design-system.md section 9).
  animations: animationSettingsSchema.default(emptyAnimationSettings()),
  // App state (global, changed by actions) and constants (fixed), see State Management.
  appState: appStateListSchema.default([]),
  constants: constantListSchema.default([])
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
  hideEditBorder: false,
  showClock: false,
  taxonomy: emptyTaxonomy(),
  generateScreenshots: false,
  versionControl: true,
  versionLimit: VERSION_LIMIT_MAX,
  classes: {},
  classCategories: [],
  classMeta: {},
  variableCategories: [],
  variables: [],
  themes: [mainTheme()],
  fonts: [],
  cssFiles: [],
  animations: emptyAnimationSettings(),
  appState: [],
  constants: []
});
