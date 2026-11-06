import { z } from "zod";
import { frameworkSchema, frameworkVariablesCss, scopeFrameworkCss } from "./framework";
import { frameworkStylesheet } from "./main-framework";
import { SAFE_VALUE, VARIABLE_NAME_PATTERN, variableCssName } from "./variables";

// Themes (docs/templates-and-themes.md section 3): named style sets. The default theme (the first
// one created) applies everywhere until a page forces another or a theme's conditions match.

export const THEME_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export const themeModeSchema = z.object({
  id: z.string().regex(THEME_SLUG_PATTERN).max(32),
  name: z.string().trim().min(1).max(32)
});
export type ThemeMode = z.infer<typeof themeModeSchema>;

// Static conditions only for now: a page, or a route pattern like /blog/* (`*` matches anything).
export const themeConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page"), pageIds: z.array(z.string().max(64)).max(200) }),
  z.object({ type: z.literal("route"), pattern: z.string().trim().min(1).max(200) })
]);
export type ThemeCondition = z.infer<typeof themeConditionSchema>;

export const themeConditionsSchema = z.object({
  match: z.enum(["all", "any"]).default("any"),
  items: z.array(themeConditionSchema).max(50).default([])
});
export type ThemeConditions = z.infer<typeof themeConditionsSchema>;

export const DEFAULT_THEME_MODES: ThemeMode[] = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" }
];

export const themeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(64),
  slug: z.string().regex(THEME_SLUG_PATTERN).max(48),
  isDefault: z.boolean().default(false),
  // Off: the theme is kept but never applies (not by conditions, not as the default, not when a page forces it).
  active: z.boolean().default(true),
  // Dark mode for the whole site on this theme. Off: only the first mode (light) exists, the
  // color-mode options are hidden and colors have no dark values. Older themes keep their dark mode.
  darkMode: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(0),
  conditions: themeConditionsSchema.default({ match: "any", items: [] }),
  modes: z.array(themeModeSchema).min(1).max(6).default(DEFAULT_THEME_MODES),
  defaultMode: z.string().default("light"),
  respectSystemPreference: z.boolean().default(false),
  // Off: visitors cannot change the color mode; a saved choice and the system preference are ignored
  // and the page always uses the default mode.
  allowModeSwitch: z.boolean().default(true),
  // The CSS framework this theme runs on (docs/design-system.md). Null: variables and classes only.
  framework: frameworkSchema.nullable().default(null),
  // Overrides of project variables, by variable name then mode id.
  variables: z
    .record(
      z.string().regex(VARIABLE_NAME_PATTERN).max(48),
      z.record(z.string().max(32), z.string().trim().min(1).max(500).regex(SAFE_VALUE))
    )
    .default({})
});
export type Theme = z.infer<typeof themeSchema>;

export const themeListSchema = z
  .array(themeSchema)
  .max(50)
  .refine((l) => new Set(l.map((t) => t.id)).size === l.length, { message: "Duplicate theme id." })
  .refine((l) => new Set(l.map((t) => t.slug)).size === l.length, {
    message: "Theme slugs must be unique."
  })
  .refine((l) => l.length === 0 || l.filter((t) => t.isDefault).length === 1, {
    message: "Exactly one theme must be the default."
  })
  .refine((l) => l.every((t) => t.modes.some((m) => m.id === t.defaultMode)), {
    message: "Default mode must be one of the theme's modes."
  });

export const slugifyTheme = (name: string): string => {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s === "") return "theme";
  return /^[a-z]/.test(s) ? s.slice(0, 48) : `theme-${s}`.slice(0, 48);
};

/** A unique slug for a new theme name. */
export function uniqueThemeSlug(name: string, themes: readonly Theme[]): string {
  const base = slugifyTheme(name);
  const taken = new Set(themes.map((t) => t.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base.slice(0, 44)}-${n}`;
  return slug;
}

/** A new theme; the first one in a project becomes the default. */
export function newTheme(id: string, name: string, themes: readonly Theme[]): Theme {
  return themeSchema.parse({
    id,
    name,
    slug: uniqueThemeSlug(name, themes),
    isDefault: themes.length === 0,
    darkMode: false
  });
}

export function matchRoute(pattern: string, route: string): boolean {
  const re = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}$`).test(route);
}

export interface ThemeContext {
  pageId: string;
  route: string;
  /** A theme chosen in page settings; wins over conditions. */
  forcedThemeId?: string | null;
}

// Specificity (docs section 2): page beats route.
const SPECIFICITY = { page: 2, route: 1 } as const;

function matchedSpecificity(theme: Theme, ctx: ThemeContext): number | null {
  const { match, items } = theme.conditions;
  if (items.length === 0) return null;
  const hits = items.map((c) => {
    if (c.type === "page") return c.pageIds.includes(ctx.pageId) ? SPECIFICITY.page : 0;
    return matchRoute(c.pattern, ctx.route) ? SPECIFICITY.route : 0;
  });
  const ok = match === "all" ? hits.every((h) => h > 0) : hits.some((h) => h > 0);
  return ok ? Math.max(...hits) : null;
}

export interface ThemeResolution {
  theme: Theme | null;
  reason: "forced" | "condition" | "default" | "none";
}

/** Forced theme, else the best matching theme (priority, specificity, name), else the default. */
export function resolveTheme(themes: readonly Theme[], ctx: ThemeContext): ThemeResolution {
  const usable = themes.filter((t) => t.active);
  const forced = ctx.forcedThemeId ? usable.find((t) => t.id === ctx.forcedThemeId) : undefined;
  if (forced) return { theme: forced, reason: "forced" };
  const matches = usable
    .filter((t) => !t.isDefault)
    .map((t) => ({ t, s: matchedSpecificity(t, ctx) }))
    .filter((m): m is { t: Theme; s: number } => m.s !== null)
    .sort((a, b) => b.t.priority - a.t.priority || b.s - a.s || a.t.name.localeCompare(b.t.name));
  const best = matches[0]?.t;
  if (best) return { theme: best, reason: "condition" };
  const fallback = usable.find((t) => t.isDefault);
  return fallback ? { theme: fallback, reason: "default" } : { theme: null, reason: "none" };
}

/** The modes a theme really has: without site-wide dark mode the dark mode does not exist. */
export function themeModes(theme: Theme): ThemeMode[] {
  if (theme.darkMode) return theme.modes;
  const light = theme.modes.filter((m) => m.id !== "dark");
  return light.length > 0 ? light : theme.modes.slice(0, 1);
}

/** The default mode, falling back to the first mode when the default one is turned off. */
export function themeDefaultMode(theme: Theme): string {
  const modes = themeModes(theme);
  return modes.some((m) => m.id === theme.defaultMode)
    ? theme.defaultMode
    : (modes[0]?.id ?? theme.defaultMode);
}

/**
 * Variable overrides of a theme, one rule per mode. The default mode also applies before any
 * `data-nxt-mode` is set, so a page without scripting still gets the default look.
 */
export function themeCss(theme: Theme): string {
  const root = `:root[data-nxt-theme="${theme.slug}"]`;
  const rules: string[] = [];
  const defaultMode = themeDefaultMode(theme);
  for (const mode of themeModes(theme)) {
    const body = Object.entries(theme.variables)
      .flatMap(([name, byMode]) => {
        const value = byMode[mode.id];
        return value && SAFE_VALUE.test(value) ? [`${variableCssName(name)}:${value}`] : [];
      })
      .join(";");
    if (!body) continue;
    const selector =
      mode.id === defaultMode
        ? `${root}[data-nxt-mode="${mode.id}"],:root:not([data-nxt-mode])`
        : `${root}[data-nxt-mode="${mode.id}"]`;
    rules.push(`${selector}{${body}}`);
  }
  const fw = theme.framework;
  const framework = fw
    ? frameworkVariablesCss(
        fw,
        theme.slug,
        themeModes(theme).some((m) => m.id === "dark")
      ) + scopeFrameworkCss(frameworkStylesheet(fw), theme.slug)
    : "";
  return framework + rules.join("");
}

/** Blocking script: sets theme and mode on <html> before first paint (saved choice wins). */
export function themeBootScript(theme: Theme): string {
  const modes = JSON.stringify(themeModes(theme).map((m) => m.id));
  const system = theme.respectSystemPreference
    ? 'if(!v&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches&&m.indexOf("dark")>-1)v="dark";'
    : "";
  const stored = theme.allowModeSwitch ? 'try{v=localStorage.getItem("nxt-mode")}catch(e){}' : "";
  return (
    `(function(){var d=document.documentElement,m=${modes},v=null;` +
    stored +
    (theme.allowModeSwitch ? system : "") +
    `if(m.indexOf(v)<0)v=${JSON.stringify(themeDefaultMode(theme))};` +
    `d.setAttribute("data-nxt-theme",${JSON.stringify(theme.slug)});d.setAttribute("data-nxt-mode",v)})()`
  );
}
