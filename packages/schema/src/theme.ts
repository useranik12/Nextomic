import { z } from "zod";
import { pruneUnusedClasses } from "./css-prune";
import {
  blankRuleContext,
  evaluateRules,
  ruleSetSchema,
  ruleSpecificity,
  type RuleContext,
  type RuleGroup
} from "./rules";
import { frameworkSchema, frameworkVariablesCss, scopeFrameworkCss } from "./framework";
import { effectiveTheme, followOverridesSchema } from "./theme-follow";
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

// Older themes stored static conditions: a list of pages, or a route pattern like /blog/* (`*`
// matches anything). They read as rules now, the same rules templates use (rules.ts).
const legacyConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page"), pageIds: z.array(z.string().max(64)).max(200) }),
  z.object({ type: z.literal("route"), pattern: z.string().trim().min(1).max(200) })
]);

/** An old route pattern as a rule: `/blog/*` starts with `/blog/`, a plain path equals itself. */
function legacyRoute(pattern: string, id: string): RuleGroup["items"][number] {
  const star = pattern.indexOf("*");
  const exact = star < 0;
  return {
    id,
    field: "page.route",
    key: "",
    op: exact ? "equals" : star === pattern.length - 1 ? "startsWith" : "contains",
    exclude: false,
    value: exact ? pattern : pattern.slice(0, star)
  };
}

/** Old `{ match, items: [{ type: "page" | "route" }] }` conditions become a rule set. */
export function migrateThemeConditions(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const old = raw as { id?: unknown; match?: unknown; items?: unknown };
  if (typeof old.id === "string" || !Array.isArray(old.items)) return raw;
  const items: RuleGroup["items"] = [];
  for (const [index, entry] of old.items.entries()) {
    const parsed = legacyConditionSchema.safeParse(entry);
    if (!parsed.success) continue;
    if (parsed.data.type === "route")
      items.push(legacyRoute(parsed.data.pattern, `legacy-${index}`));
    else if (parsed.data.pageIds.length > 0)
      items.push({
        id: `legacy-${index}`,
        field: "page.id",
        key: "",
        op: "isIn",
        exclude: false,
        value: parsed.data.pageIds.join(", ")
      });
  }
  return { id: "root", match: old.match === "all" ? "all" : "any", items };
}

export const themeConditionsSchema = z.preprocess(migrateThemeConditions, ruleSetSchema);
export type ThemeConditions = RuleGroup;

/** Themes have two color modes: light and dark (dark only when the theme turns on dark mode). */
export const DEFAULT_THEME_MODES: ThemeMode[] = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" }
];

/** The mode ids a theme can have. */
export const BUILTIN_MODE_IDS: readonly string[] = DEFAULT_THEME_MODES.map((m) => m.id);

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
  conditions: themeConditionsSchema.default({ id: "root", match: "any", items: [] }),
  // Always light and dark; older custom modes are dropped when read.
  modes: z
    .array(themeModeSchema)
    .max(6)
    .default(DEFAULT_THEME_MODES)
    .transform(() => DEFAULT_THEME_MODES.map((m) => ({ ...m }))),
  defaultMode: z
    .string()
    .default("light")
    .transform((v) => (v === "dark" ? "dark" : "light")),
  respectSystemPreference: z.boolean().default(false),
  // Off: visitors cannot change the color mode; a saved choice and the system preference are ignored
  // and the page always uses the default mode.
  allowModeSwitch: z.boolean().default(true),
  // The CSS framework this theme runs on (docs/design-system.md). Null: variables and classes only.
  framework: frameworkSchema.nullable().default(null),
  // On (never on the default theme): the theme reads the default theme's framework live and keeps
  // only its own values in `overrides` (theme-follow.ts). Its own framework is then null.
  followPrimary: z.boolean().default(false),
  overrides: followOverridesSchema.default({ variables: {}, scales: {} }),
  // Overrides of project variables, by variable name then mode id.
  variables: z
    .record(
      z.string().regex(VARIABLE_NAME_PATTERN).max(48),
      z.record(z.string().max(32), z.string().trim().min(1).max(500).regex(SAFE_VALUE))
    )
    .default({})
    .transform((byName) =>
      Object.fromEntries(
        Object.entries(byName).map(([name, byMode]) => [
          name,
          Object.fromEntries(
            Object.entries(byMode).filter(([mode]) => BUILTIN_MODE_IDS.includes(mode))
          )
        ])
      )
    )
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
  .refine((l) => l.every((t) => !(t.isDefault && t.followPrimary)), {
    message: "The default theme cannot follow itself."
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
  /** All facts about the request (server); without it only the page id and route are known. */
  rules?: RuleContext;
}

function ruleContextOf(ctx: ThemeContext): RuleContext {
  if (ctx.rules) return ctx.rules;
  const base = blankRuleContext();
  return blankRuleContext({
    page: { ...base.page, id: ctx.pageId, route: ctx.route },
    url: { ...base.url, path: ctx.route, full: ctx.route }
  });
}

/** How narrowly a theme matched, or null when its rules do not match (or it has none). */
function matchedSpecificity(theme: Theme, ctx: RuleContext): number | null {
  if (theme.conditions.items.length === 0) return null;
  return evaluateRules(theme.conditions, ctx) ? ruleSpecificity(theme.conditions) : null;
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
  const rules = ruleContextOf(ctx);
  const matches = usable
    .filter((t) => !t.isDefault)
    .map((t) => ({ t, s: matchedSpecificity(t, rules) }))
    .filter((m): m is { t: Theme; s: number } => m.s !== null)
    .sort((a, b) => b.t.priority - a.t.priority || b.s - a.s || a.t.name.localeCompare(b.t.name));
  const best = matches[0]?.t;
  if (best) return { theme: best, reason: "condition" };
  const fallback = usable.find((t) => t.isDefault);
  return fallback ? { theme: fallback, reason: "default" } : { theme: null, reason: "none" };
}

/**
 * Like `resolveTheme`, but the theme comes back as it renders (a follower resolved against the
 * primary). For output and display only: never write the result back to the project.
 */
export function resolveRenderTheme(themes: readonly Theme[], ctx: ThemeContext): ThemeResolution {
  const found = resolveTheme(themes, ctx);
  return found.theme ? { ...found, theme: effectiveTheme(found.theme, themes) } : found;
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
export function themeCss(theme: Theme, usedClasses?: ReadonlySet<string>): string {
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
      ) +
      scopeFrameworkCss(
        usedClasses
          ? pruneUnusedClasses(frameworkStylesheet(fw), usedClasses)
          : frameworkStylesheet(fw),
        theme.slug
      )
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
