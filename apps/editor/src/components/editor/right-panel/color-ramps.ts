import { DEFAULT_COLOR_GROUP } from "@nextomic/schema";
import type { DesignVariable } from "./use-design-variables";

export type ColorMode = "light" | "dark";

const INNER = /var\(\s*(--[a-z][a-z0-9-]*)\s*\)/gi;

/**
 * The color a value shows in a color mode: a plain color as is, a `var(--name)` looked up in the
 * project and theme framework variables (their dark value in dark mode). References inside
 * color-mix() and friends are resolved too.
 */
export function resolveColor(
  value: string | undefined,
  variables: readonly DesignVariable[],
  mode: ColorMode = "light",
  depth = 0
): string | null {
  if (!value) return null;
  const text = value.trim();
  if (depth > 6) return null;
  if (!text.includes("var(")) return text;
  let failed = false;
  const out = text.replace(INNER, (_m, name: string) => {
    const found = variables.find((v) => v.cssName === name);
    const own = found ? (mode === "dark" ? (found.dark ?? found.value) : found.value) : undefined;
    const color = found ? resolveColor(own, variables, mode, depth + 1) : null;
    if (color === null) failed = true;
    return color ?? "transparent";
  });
  return failed ? null : out;
}

export interface Swatch {
  key: string;
  name: string;
  /** The color in light mode. */
  color: string;
  /** The color in dark mode, only when it differs from the light one. */
  darkColor?: string;
  /** What gets stored when picked: a `var(--nxt-name)` reference. */
  value: string;
}

/** A color with the shades it generates, lined up from the darkest to the lightest. */
export interface Ramp {
  base: Swatch;
  /** `d-N` to `d-1`, darkest first. */
  darker: Swatch[];
  /** `l-1` to `l-N`, nearest the base first. */
  lighter: Swatch[];
  /** `t-NN`, the see-through shades, most transparent first. */
  clear: Swatch[];
}

export const rampSwatches = (r: Ramp): Swatch[] => [...r.darker, r.base, ...r.lighter, ...r.clear];

const SHADE = /^(.*)-(l|d|t)-(\d{1,2})$/;

/**
 * The color variables grouped by palette, each color as a ramp with its shades. A shade whose base
 * color is not in the same list stays a color of its own. With `dualMode` a swatch also carries
 * its dark mode color.
 */
export function buildPalettes(
  variables: readonly DesignVariable[],
  dualMode: boolean
): [string, Ramp[]][] {
  const colors = variables.filter((v) => v.type === "color");
  const names = new Set(colors.map((v) => v.name));
  const swatch = (v: DesignVariable): Swatch => {
    const color = resolveColor(v.ref, variables) ?? v.value;
    const dark = dualMode ? resolveColor(v.ref, variables, "dark") : null;
    return {
      key: v.key,
      name: v.name,
      color,
      ...(dark && dark !== color ? { darkColor: dark } : {}),
      value: v.ref
    };
  };
  const ramps = new Map<string, Ramp>();
  const order: DesignVariable[] = [];
  for (const v of colors) {
    const m = SHADE.exec(v.name);
    if (m && names.has(m[1] as string)) continue;
    ramps.set(v.name, { base: swatch(v), darker: [], lighter: [], clear: [] });
    order.push(v);
  }
  for (const v of colors) {
    const m = SHADE.exec(v.name);
    const ramp = m ? ramps.get(m[1] as string) : undefined;
    if (!m || !ramp) continue;
    const list = m[2] === "d" ? ramp.darker : m[2] === "l" ? ramp.lighter : ramp.clear;
    list.push(swatch(v));
  }
  for (const r of ramps.values()) r.darker.reverse();
  const palettes = new Map<string, Ramp[]>();
  for (const v of order) {
    const list = palettes.get(v.group || DEFAULT_COLOR_GROUP) ?? [];
    list.push(ramps.get(v.name) as Ramp);
    palettes.set(v.group || DEFAULT_COLOR_GROUP, list);
  }
  return [...palettes.entries()];
}
