// Color parsing and formatting for the color picker (HEX, RGB, HSL, CSS, with alpha). Everything
// is pure so the picker, the palette manager and the tests share one implementation.

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0 to 1. */
  a: number;
}

export interface Hsla {
  /** 0 to 360. */
  h: number;
  /** 0 to 100. */
  s: number;
  /** 0 to 100. */
  l: number;
  a: number;
}

export interface Hsva {
  h: number;
  /** 0 to 100. */
  s: number;
  /** 0 to 100. */
  v: number;
  a: number;
}

export const COLOR_FORMATS = ["hex", "rgb", "hsl", "css"] as const;
export type ColorFormat = (typeof COLOR_FORMATS)[number];

const NAMED: Record<string, string> = {
  transparent: "#00000000",
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  gray: "#808080",
  grey: "#808080",
  cyan: "#00ffff",
  magenta: "#ff00ff"
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, digits = 0): number => {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

function parseAlpha(token: string | undefined): number {
  if (token === undefined || token === "") return 1;
  const t = token.trim();
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return NaN;
  return clamp(t.endsWith("%") ? n / 100 : n, 0, 1);
}

function parseHex(text: string): Rgba | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (!m) return null;
  let h = m[1] as string;
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number): number => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? round(n(6) / 255, 3) : 1 };
}

const FN = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i;

function parseChannels(args: string): { parts: string[]; alpha: string | undefined } | null {
  // Both "r, g, b, a" and "r g b / a" are accepted.
  const slash = args.split("/");
  if (slash.length > 2) return null;
  const head = (slash[0] ?? "")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (slash.length === 2)
    return head.length === 3 ? { parts: head, alpha: slash[1]?.trim() } : null;
  if (head.length === 4) return { parts: head.slice(0, 3), alpha: head[3] };
  return head.length === 3 ? { parts: head, alpha: undefined } : null;
}

/** Parses hex, rgb()/rgba(), hsl()/hsla() and a few color names. Returns null for anything else. */
export function parseColor(input: string): Rgba | null {
  const text = input.trim().toLowerCase();
  if (text === "") return null;
  const named = NAMED[text];
  if (named) return parseHex(named);
  if (text.startsWith("#")) return parseHex(text);
  const fn = FN.exec(text);
  if (!fn) return null;
  const channels = parseChannels(fn[2] ?? "");
  if (!channels) return null;
  const a = parseAlpha(channels.alpha);
  if (Number.isNaN(a)) return null;
  const [p0, p1, p2] = channels.parts.map((p) => parseFloat(p));
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;
  if ([p0, p1, p2].some((n) => !Number.isFinite(n))) return null;
  if ((fn[1] ?? "").startsWith("rgb")) {
    const pct = (i: number, v: number): number =>
      channels.parts[i]?.endsWith("%") ? (v / 100) * 255 : v;
    return {
      r: clamp(round(pct(0, p0)), 0, 255),
      g: clamp(round(pct(1, p1)), 0, 255),
      b: clamp(round(pct(2, p2)), 0, 255),
      a
    };
  }
  return hslToRgb({ h: p0, s: clamp(p1, 0, 100), l: clamp(p2, 0, 100), a });
}

export const isColor = (text: string): boolean => parseColor(text) !== null;

export function rgbToHsl({ r, g, b, a }: Rgba): Hsla {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: round(h, 1), s: round(s * 100, 1), l: round(l * 100, 1), a };
}

export function hslToRgb({ h, s, l, a }: Hsla): Rgba {
  const sn = s / 100;
  const ln = l / 100;
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ln - c / 2;
  return {
    r: round(((r1 ?? 0) + m) * 255),
    g: round(((g1 ?? 0) + m) * 255),
    b: round(((b1 ?? 0) + m) * 255),
    a
  };
}

export function rgbToHsv({ r, g, b, a }: Rgba): Hsva {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h: round(h, 1),
    s: round(max === 0 ? 0 : (d / max) * 100, 1),
    v: round(max * 100, 1),
    a
  };
}

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const sn = s / 100;
  const vn = v / 100;
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = vn * sn;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = vn - c;
  return {
    r: round(((r1 ?? 0) + m) * 255),
    g: round(((g1 ?? 0) + m) * 255),
    b: round(((b1 ?? 0) + m) * 255),
    a
  };
}

const hex2 = (n: number): string => clamp(round(n), 0, 255).toString(16).padStart(2, "0");

/** `#rrggbb`, or `#rrggbbaa` when the color is not fully opaque. */
export function toHex({ r, g, b, a }: Rgba): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a * 255) : ""}`;
}

export function toRgbString({ r, g, b, a }: Rgba): string {
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${round(a, 2)})` : `rgb(${r}, ${g}, ${b})`;
}

export function toHslString(color: Rgba): string {
  const { h, s, l, a } = rgbToHsl(color);
  return a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${round(a, 2)})` : `hsl(${h}, ${s}%, ${l}%)`;
}

/** The color written in one of the picker's modes. "css" keeps the text the user typed. */
export function formatColor(color: Rgba, mode: ColorFormat, css = ""): string {
  switch (mode) {
    case "hex":
      return toHex(color);
    case "rgb":
      return toRgbString(color);
    case "hsl":
      return toHslString(color);
    case "css":
      return css.trim() !== "" ? css.trim() : toHex(color);
  }
}

/** The mode a color string is written in, for opening the picker on the right tab. */
export function detectColorFormat(text: string): ColorFormat {
  const t = text.trim().toLowerCase();
  if (t.startsWith("#")) return "hex";
  if (t.startsWith("rgb")) return "rgb";
  if (t.startsWith("hsl")) return "hsl";
  return "css";
}

/** Same color with another alpha (0 to 1). */
export const withAlpha = (color: Rgba, a: number): Rgba => ({ ...color, a: clamp(a, 0, 1) });
