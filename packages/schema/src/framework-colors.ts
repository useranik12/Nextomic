import { z } from "zod";
import { isColor } from "./color";
import type { FrameworkVariable } from "./framework";

// Colors of a framework (docs/design-system.md). A color is a framework variable whose value is a
// color. Options say which shades and utility classes are generated from it; the generated
// variables and classes are derived at output time and never stored.

/** CSS properties a color can generate utility classes for, with the class prefix of each. */
export const UTILITY_PROPS = [
  { property: "background-color", prefix: "bg" },
  { property: "color", prefix: "text" },
  { property: "border-color", prefix: "border" },
  { property: "outline-color", prefix: "outline" },
  { property: "fill", prefix: "fill" },
  { property: "stroke", prefix: "stroke" }
] as const;
export type UtilityProperty = (typeof UTILITY_PROPS)[number]["property"];
const UTILITY_PROPERTY_NAMES = UTILITY_PROPS.map((p) => p.property) as [
  UtilityProperty,
  ...UtilityProperty[]
];

export const MAX_SHADES = 10;

export const colorOptionSchema = z.object({
  light: z.boolean().default(false),
  dark: z.boolean().default(false),
  transparent: z.boolean().default(false),
  /** How many light and dark shades to generate (1 to 10 each). */
  lightCount: z.number().int().min(1).max(MAX_SHADES).default(3),
  darkCount: z.number().int().min(1).max(MAX_SHADES).default(3),
  transparentCount: z.number().int().min(1).max(MAX_SHADES).default(5),
  utility: z.array(z.enum(UTILITY_PROPERTY_NAMES)).max(6).default([]),
  /** Shades the user set by hand, by shade key (`l-1`, `d-2`, `t-20`); they replace the generated mix. */
  overrides: z
    .record(z.string().regex(/^(?:l|d)-\d{1,2}$|^t-\d{2}$/), z.string().trim().min(1).max(120))
    .default({})
});
export type ColorOptions = z.infer<typeof colorOptionSchema>;

export const colorOptionsMapSchema = z.record(z.string().max(64), colorOptionSchema);
export type ColorOptionsMap = z.infer<typeof colorOptionsMapSchema>;

export const NO_COLOR_OPTIONS: ColorOptions = {
  light: false,
  dark: false,
  transparent: false,
  lightCount: 3,
  darkCount: 3,
  transparentCount: 5,
  utility: [],
  overrides: {}
};

/** Share of the base color kept in each shade (the rest is white, black or transparent). */
/** Share of the base color kept in each of `count` transparent shades, from the most see-through up. */
export function transparentPercents(count: number): number[] {
  if (count === 5) return [10, 20, 40, 60, 80];
  if (count === 1) return [50];
  return Array.from({ length: count }, (_, i) => Math.round(10 + (i * 80) / (count - 1)));
}

/** Share of the base color kept in each of `count` light shades, from nearest to the base to lightest. */
export function lightPercents(count: number): number[] {
  if (count === 3) return [85, 65, 15];
  if (count === 1) return [50];
  return Array.from({ length: count }, (_, i) => Math.round(90 - (i * 80) / (count - 1)));
}

/** Share of the base color kept in each of `count` dark shades, from nearest to the base to darkest. */
export function darkPercents(count: number): number[] {
  if (count === 3) return [85, 70, 50];
  if (count === 1) return [70];
  return Array.from({ length: count }, (_, i) => Math.round(90 - (i * 55) / (count - 1)));
}

const SHADE_NAME = /-(?:l|d)-\d{1,2}$|-t-\d{2}$/;

interface ShadeInfo {
  name: string;
  value: string;
  /** The shade key within its group, for the class list: `l-1`, `d-2`, `t-20`. */
  suffix: string;
}

/** A mix of a base color (a `var(--name)` reference or a literal color) with white, black or transparent. */
export const colorMix = (
  base: string,
  pct: number,
  to: "white" | "black" | "transparent"
): string => `color-mix(in srgb, ${base} ${pct}%, ${to})`;
const mix = (base: string, pct: number, to: "white" | "black" | "transparent"): string =>
  colorMix(`var(--${base})`, pct, to);

/** The shade variables one color generates from its options. */
export function shadesOf(name: string, options: ColorOptions): ShadeInfo[] {
  const out: ShadeInfo[] = [];
  const add = (suffix: string, value: string) =>
    out.push({ name: `${name}-${suffix}`, suffix, value: options.overrides[suffix] ?? value });
  if (options.light)
    lightPercents(options.lightCount).forEach((pct, i) =>
      add(`l-${i + 1}`, mix(name, pct, "white"))
    );
  if (options.dark)
    darkPercents(options.darkCount).forEach((pct, i) => add(`d-${i + 1}`, mix(name, pct, "black")));
  if (options.transparent)
    for (const pct of transparentPercents(options.transparentCount))
      add(`t-${pct}`, mix(name, pct, "transparent"));
  return out;
}

interface HasColors {
  variables: readonly FrameworkVariable[];
  colorOptions: ColorOptionsMap;
}

/** Variables derived from color options, for colors that exist as variables. */
export function derivedColorVariables(fw: HasColors): FrameworkVariable[] {
  const names = new Set(fw.variables.map((v) => v.name));
  const out: FrameworkVariable[] = [];
  for (const [name, options] of Object.entries(fw.colorOptions)) {
    if (!names.has(name)) continue;
    for (const s of shadesOf(name, options))
      if (!names.has(s.name)) out.push({ name: s.name, value: s.value });
  }
  return out;
}

const COLORISH = /^(#|(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(|color-mix\(|color\()/i;

/** Names of every shade the options generate, whether or not the base color exists. */
export function shadeNames(fw: HasColors): Set<string> {
  const out = new Set<string>();
  for (const [name, options] of Object.entries(fw.colorOptions))
    for (const s of shadesOf(name, options)) out.add(s.name);
  return out;
}

/** True when a CSS value is a color (a plain color or a color function such as color-mix()). */
export const looksLikeColor = (value: string): boolean =>
  isColor(value) || COLORISH.test(value.trim());

/** True for a variable that is a color the manager lists (not a generated-looking shade of another). */
export function isBaseColor(v: FrameworkVariable, all: readonly FrameworkVariable[]): boolean {
  if (!looksLikeColor(v.value)) return false;
  if (SHADE_NAME.test(v.name)) {
    const base = v.name.replace(SHADE_NAME, "");
    if (all.some((x) => x.name === base)) return false;
  }
  return true;
}

/** Utility classes of the colors that ask for them, as CSS (`.bg-primary{background-color:var(--primary)}`). */
export function colorUtilityRules(fw: HasColors): { selector: string; css: string }[] {
  const names = new Set(fw.variables.map((v) => v.name));
  const rules: { selector: string; css: string }[] = [];
  for (const [name, options] of Object.entries(fw.colorOptions)) {
    if (!names.has(name) || options.utility.length === 0) continue;
    const targets = [name, ...shadesOf(name, options).map((s) => s.name)];
    for (const prop of UTILITY_PROPS) {
      if (!options.utility.includes(prop.property)) continue;
      for (const target of targets)
        rules.push({
          selector: `.${prop.prefix}-${target}`,
          css: `.${prop.prefix}-${target}{${prop.property}:var(--${target})}`
        });
    }
  }
  return rules;
}

export const colorUtilityCss = (fw: HasColors): string =>
  colorUtilityRules(fw)
    .map((r) => r.css)
    .join("");
