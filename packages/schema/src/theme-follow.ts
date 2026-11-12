import { z } from "zod";
import { applyScale, scaleSchema, type Framework, type ScaleSettings } from "./framework";
import { SAFE_VALUE } from "./variables";
import type { Theme } from "./theme";

// Follow Primary (docs/templates-and-themes.md section 3.6). A follower theme owns no framework:
// it reads the primary (default) theme's framework live and stores only what differs, so one set of
// names (variables, classes, colors) serves every theme and only the values change.
//
// - `framework` of a follower is null; `variables` holds its own project-variable overrides.
// - `overrides.variables`: value and dark value per framework variable name.
// - `overrides.scales`: the numbers of a fluid scale per scale prefix (never its names).
// - The structure (variable names, classes, colors, scale names) always comes from the primary.

const VALUE = z.string().trim().min(1).max(500).regex(SAFE_VALUE);

export const scaleOverrideSchema = scaleSchema
  .pick({
    baseIndex: true,
    baseMin: true,
    baseMax: true,
    ratioMin: true,
    ratioMax: true,
    minScreen: true,
    maxScreen: true
  })
  .partial();
export type ScaleOverride = z.infer<typeof scaleOverrideSchema>;

export const variableOverrideSchema = z.object({
  value: VALUE.optional(),
  /** A text sets the dark value; null removes the primary's dark value for this theme. */
  dark: VALUE.nullable().optional()
});
export type VariableOverride = z.infer<typeof variableOverrideSchema>;

export const followOverridesSchema = z.object({
  variables: z.record(z.string().max(64), variableOverrideSchema).default({}),
  scales: z.record(z.string().max(24), scaleOverrideSchema).default({})
});
export type FollowOverrides = z.infer<typeof followOverridesSchema>;

export const NO_OVERRIDES: FollowOverrides = { variables: {}, scales: {} };

const SCALE_KEYS = [
  "baseIndex",
  "baseMin",
  "baseMax",
  "ratioMin",
  "ratioMax",
  "minScreen",
  "maxScreen"
] as const satisfies readonly (keyof ScaleSettings)[];

export const primaryTheme = (themes: readonly Theme[]): Theme | null =>
  themes.find((t) => t.isDefault) ?? null;

/** True when the theme reads its look from the primary theme (never the primary itself). */
export function followsPrimary(theme: Theme, themes: readonly Theme[]): boolean {
  return theme.followPrimary && !theme.isDefault && primaryTheme(themes) !== null;
}

/** Themes that are on. Follow Primary is offered only when two or more are. */
export const activeThemeCount = (themes: readonly Theme[]): number =>
  themes.filter((t) => t.active).length;

export const canOfferFollow = (themes: readonly Theme[]): boolean => activeThemeCount(themes) >= 2;

/** Active themes that follow the primary: the ones a visitor can be switched to by an action. */
export function switchableThemes(themes: readonly Theme[]): Theme[] {
  const primary = primaryTheme(themes);
  if (!primary?.active) return [];
  return themes.filter((t) => t.active && (t.isDefault || followsPrimary(t, themes)));
}

/** The Set Theme action needs the primary plus at least one active follower. */
export const canSwitchThemes = (themes: readonly Theme[]): boolean =>
  switchableThemes(themes).length >= 2;

function withScaleOverrides(base: Framework, scales: FollowOverrides["scales"]): Framework {
  return base.scales.reduce((fw, scale) => {
    const own = scales[scale.prefix];
    return own ? applyScale(fw, { ...scale, ...own }) : fw;
  }, base);
}

function withVariableOverrides(fw: Framework, own: FollowOverrides["variables"]): Framework {
  return {
    ...fw,
    variables: fw.variables.map((v) => {
      const o = own[v.name];
      if (!o) return v;
      const { dark: _dark, ...rest } = v;
      const dark = o.dark === undefined ? v.dark : (o.dark ?? undefined);
      return { ...rest, value: o.value ?? v.value, ...(dark === undefined ? {} : { dark }) };
    })
  };
}

/** The framework a theme really runs on: its own, or the primary's with the theme's overrides. */
export function effectiveFramework(theme: Theme, themes: readonly Theme[]): Framework | null {
  if (!followsPrimary(theme, themes)) return theme.framework;
  const base = primaryTheme(themes)?.framework;
  if (!base) return null;
  return withVariableOverrides(
    withScaleOverrides(base, theme.overrides.scales),
    theme.overrides.variables
  );
}

/**
 * The theme as it renders: framework, variable overrides and dark mode resolved against the primary.
 * Use it to read a theme for output or display; never write the result back to the project.
 */
export function effectiveTheme(theme: Theme, themes: readonly Theme[]): Theme {
  const primary = primaryTheme(themes);
  if (!primary || !followsPrimary(theme, themes)) return theme;
  const names = new Set([...Object.keys(primary.variables), ...Object.keys(theme.variables)]);
  const variables = Object.fromEntries(
    [...names].map((name) => [name, { ...primary.variables[name], ...theme.variables[name] }])
  );
  return {
    ...theme,
    framework: effectiveFramework(theme, themes),
    variables,
    darkMode: primary.darkMode || theme.darkMode
  };
}

/** Dark mode is on and locked while a follower's primary has it; otherwise the theme decides. */
export const darkModeLocked = (theme: Theme, themes: readonly Theme[]): boolean =>
  followsPrimary(theme, themes) && (primaryTheme(themes)?.darkMode ?? false);

/** Turns Follow Primary on: the theme's own framework, scales and overrides are replaced. */
export function startFollowing(theme: Theme): Theme {
  return {
    ...theme,
    followPrimary: true,
    framework: null,
    variables: {},
    overrides: { variables: {}, scales: {} }
  };
}

/** Turns Follow Primary off: what the theme looks like now becomes its own, so nothing is lost. */
export function stopFollowing(theme: Theme, themes: readonly Theme[]): Theme {
  if (!followsPrimary(theme, themes)) return { ...theme, followPrimary: false };
  const own = effectiveTheme(theme, themes);
  return {
    ...theme,
    followPrimary: false,
    framework: own.framework,
    variables: own.variables,
    darkMode: own.darkMode,
    overrides: { variables: {}, scales: {} }
  };
}

/** What replacing a theme's own look with the primary's would remove, for the confirm dialog. */
export interface FollowLoss {
  variables: number;
  classRules: boolean;
  scales: number;
  overrides: number;
}

export function followLoss(theme: Theme): FollowLoss {
  const fw = theme.framework;
  return {
    variables: fw?.variables.length ?? 0,
    classRules: (fw?.css ?? "").trim() !== "",
    scales: fw?.scales.length ?? 0,
    overrides: Object.keys(theme.variables).length
  };
}

export type FollowEdit = { ok: true; overrides: FollowOverrides } | { ok: false; error: string };

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const STRUCTURE_FOLLOWS =
  "Names, classes and structure follow the primary theme. Change them there, or turn off Follow Primary for this theme.";

/**
 * The overrides that turn the primary's framework into `next`. Value and scale-number changes
 * become overrides (an edit back to the primary's value drops one); changes to names, classes,
 * colors or scale steps are refused because they belong to the primary.
 */
export function diffFollower(theme: Theme, themes: readonly Theme[], next: Framework): FollowEdit {
  const base = primaryTheme(themes)?.framework;
  if (!base) return { ok: false, error: "The primary theme has no framework." };
  const { variables: nextVars, scales: nextScales, ...nextRest } = next;
  const { variables: baseVars, scales: baseScales, ...baseRest } = base;
  const sameNames =
    nextVars.length === baseVars.length &&
    nextVars.every((v) => baseVars.some((b) => b.name === v.name));
  const sameScales =
    nextScales.length === baseScales.length &&
    nextScales.every((s) => {
      const b = baseScales.find((x) => x.prefix === s.prefix);
      return b !== undefined && sameJson(s.names, b.names) && s.kind === b.kind;
    });
  if (!sameNames || !sameScales || !sameJson(nextRest, baseRest))
    return { ok: false, error: STRUCTURE_FOLLOWS };

  const scales: FollowOverrides["scales"] = {};
  for (const s of nextScales) {
    const b = baseScales.find((x) => x.prefix === s.prefix);
    if (!b) continue;
    const changed = Object.fromEntries(
      SCALE_KEYS.filter((k) => s[k] !== b[k]).map((k) => [k, s[k]])
    );
    if (Object.keys(changed).length > 0) scales[s.prefix] = changed;
  }
  // Variables are compared with the primary after the scale numbers apply, so a scale edit does
  // not freeze every generated step as a variable override.
  const scaled = withScaleOverrides(base, scales);
  const variables: FollowOverrides["variables"] = {};
  for (const v of nextVars) {
    const b = scaled.variables.find((x) => x.name === v.name);
    if (!b) continue;
    const o: VariableOverride = {};
    if (v.value !== b.value) o.value = v.value;
    if (v.dark !== b.dark) o.dark = v.dark ?? null;
    if (Object.keys(o).length > 0) variables[v.name] = o;
  }
  return { ok: true, overrides: { variables, scales } };
}

/** The theme with a framework edit applied: a follower stores overrides, any other theme the framework. */
export function withFramework(
  theme: Theme,
  themes: readonly Theme[],
  next: Framework | null
): Theme | string {
  if (!followsPrimary(theme, themes)) return { ...theme, framework: next };
  if (!next) return STRUCTURE_FOLLOWS;
  const edit = diffFollower(theme, themes, next);
  return edit.ok ? { ...theme, overrides: edit.overrides } : edit.error;
}

/** What the runtime needs to switch a visitor to a theme. */
export const themeChoiceSchema = z.object({
  id: z.string().max(64),
  slug: z.string().max(48),
  name: z.string().max(64),
  modes: z.array(z.string().max(32)).max(6),
  defaultMode: z.string().max(32)
});
export type ThemeChoice = z.infer<typeof themeChoiceSchema>;

/**
 * The other themes a page ships so a visitor can switch to them (as rendered). Empty when the
 * page's theme is forced in page settings, is not the primary or a follower, or the project cannot
 * switch themes.
 */
export function themeSwitching(
  themes: readonly Theme[],
  resolved: Theme | null,
  forced: boolean
): Theme[] {
  if (!resolved || forced || !canSwitchThemes(themes)) return [];
  const all = switchableThemes(themes);
  if (!all.some((t) => t.id === resolved.id)) return [];
  return all.filter((t) => t.id !== resolved.id).map((t) => effectiveTheme(t, themes));
}
