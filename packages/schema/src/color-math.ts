import { detectColorFormat, formatColor, parseColor, type ColorFormat, type Rgba } from "./color";

// Perceptual color math (OKLab / OKLCH, Bjorn Ottosson) for generated colors: a dark mode version
// of a color, and the colors of shades as the browser's `color-mix(in srgb, …)` makes them. Pure
// functions, shared by the Colors manager and the tests.

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number): number =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export interface Oklch {
  /** Perceptual lightness, 0 (black) to 1 (white). */
  l: number;
  /** Chroma, about 0 to 0.4. */
  c: number;
  /** Hue angle in degrees. */
  h: number;
}

export function rgbToOklch({ r, g, b }: Rgba): Oklch {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Linear sRGB of an OKLCH color; channels outside 0 to 1 mean it is out of gamut. */
function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  ];
}

const inGamut = (rgb: readonly number[]): boolean => rgb.every((v) => v >= -0.0001 && v <= 1.0001);

/** OKLCH to sRGB. A color outside the sRGB gamut keeps its lightness and hue and loses chroma until it fits. */
export function oklchToRgb(color: Oklch, a = 1): Rgba {
  let lo = 0;
  let hi = color.c;
  let rgb = oklchToLinear(color);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear({ ...color, c: lo });
  }
  const [r, g, b] = rgb.map((v) => clamp(Math.round(fromLinear(clamp(v, 0, 1))), 0, 255)) as [
    number,
    number,
    number
  ];
  return { r, g, b, a };
}

/** The lightness a dark mode version of a color gets, always lower than the original. */
export function darkLightness(l: number): number {
  // Dark and mid colors keep their order but sit lower; light colors are turned over so white
  // becomes a deep neutral. Both branches meet at 0.36 and the result is below `l` everywhere.
  return l <= 0.6 ? l * 0.6 : 0.36 - (l - 0.6) * 0.5;
}

/**
 * The dark mode version of a color: same hue, a little less chroma (colors glare on dark
 * backgrounds) and a lower lightness, computed in OKLCH so the change looks even across hues.
 * Written in the same format as the input. Returns null when the value is not a color.
 */
export function darkVariant(value: string): string | null {
  const rgba = parseColor(value);
  if (!rgba) return null;
  const { l, c, h } = rgbToOklch(rgba);
  const dark = oklchToRgb({ l: darkLightness(l), c: c * 0.9, h }, rgba.a);
  const format = detectColorFormat(value);
  return formatColor(dark, format === "css" ? "hex" : format);
}

/** Mixes `pct` percent of a color with white, black or transparent, the way `color-mix(in srgb)` does. */
export function mixColor(base: Rgba, pct: number, to: "white" | "black" | "transparent"): Rgba {
  const p = clamp(pct, 0, 100) / 100;
  if (to === "transparent") return { ...base, a: Math.round(base.a * p * 1000) / 1000 };
  const target = to === "white" ? 255 : 0;
  const mixed = (c: number): number => Math.round(c * p + target * (1 - p));
  return { r: mixed(base.r), g: mixed(base.g), b: mixed(base.b), a: base.a };
}

/**
 * The text of a shade as a mix of the base color, written in the base color's format (hex, rgb,
 * hsl). Returns null when the base is not a plain color (for example a `var()` reference).
 */
export function mixedColorText(
  baseText: string,
  pct: number,
  to: "white" | "black" | "transparent"
): { text: string; format: ColorFormat } | null {
  const base = parseColor(baseText);
  if (!base) return null;
  const format = detectColorFormat(baseText);
  const shown: ColorFormat = format === "css" ? "hex" : format;
  return { text: formatColor(mixColor(base, pct, to), shown), format: shown };
}
