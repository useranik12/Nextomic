import type { Framework } from "./framework";
import { colorMix, shadesOf } from "./framework-colors";

// Inverse colors. An element can use a theme color the other way round: the dark value in light
// mode and the light value in dark mode (a reversed section on a page). Nothing inverted is stored
// in the framework or its stylesheet. The element's style keeps `nxt-inv(var(--name))`, and only
// when a page is rendered is that replaced by `light-dark(<dark value>, <light value>)` with the
// values of the framework, so the CSS only holds what pages actually use.

export const INVERT_FN = "nxt-inv";
const INVERTED = /nxt-inv\(\s*var\(\s*--([A-Za-z0-9_-]+)\s*\)\s*\)/g;
const WHOLE = /^\s*nxt-inv\(\s*(var\(\s*--[A-Za-z0-9_-]+\s*\))\s*\)\s*$/;

/** The stored value of a color reference used inverted. */
export const invertedRef = (ref: string): string => `${INVERT_FN}(${ref})`;

/** True when the whole value is an inverted color reference. */
export const isInverted = (value: string | undefined): boolean =>
  value !== undefined && WHOLE.test(value);

/** The plain reference of an inverted one (`nxt-inv(var(--x))` gives `var(--x)`); other values as they are. */
export function plainRef(value: string): string {
  return WHOLE.exec(value)?.[1] ?? value;
}

/**
 * The light mode and dark mode value of a framework color or shade as literal colors, or null when
 * both modes show the same color (so there is nothing to invert).
 */
export function modeValues(fw: Framework, name: string): { light: string; dark: string } | null {
  const own = fw.variables.find((v) => v.name === name);
  if (own)
    return own.dark === undefined || own.dark === own.value
      ? null
      : { light: own.value, dark: own.dark };
  for (const [base, options] of Object.entries(fw.colorOptions)) {
    const shade = shadesOf(base, options).find((s) => s.name === name);
    const bv = fw.variables.find((v) => v.name === base);
    if (!shade || !bv) continue;
    const light = options.overrides[shade.suffix] ?? colorMix(bv.value, shade.pct, shade.to);
    const dark = shade.darkTo
      ? (options.darkOverrides[shade.suffix] ??
        colorMix(bv.dark ?? bv.value, shade.pct, shade.darkTo))
      : (options.overrides[shade.suffix] ?? colorMix(bv.dark ?? bv.value, shade.pct, shade.to));
    return light === dark ? null : { light, dark };
  }
  return null;
}

/**
 * Replaces every inverted color reference in rendered CSS by its `light-dark()` pair. A color with
 * no second value (or one the framework does not have) falls back to the plain variable.
 */
export function flipInverted(css: string, fw: Framework | null | undefined): string {
  if (!css.includes(INVERT_FN)) return css;
  return css.replace(INVERTED, (_, name: string) => {
    const values = fw ? modeValues(fw, name) : null;
    return values ? `light-dark(${values.dark},${values.light})` : `var(--${name})`;
  });
}
