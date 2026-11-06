import { z } from "zod";

// Project variables (docs/design-system.md section 6). A variable `text-m` is written to the
// output as `--nxt-text-m` and referenced from styles as `var(--nxt-text-m)`.

export const VARIABLE_PREFIX = "--nxt-";
export const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export const VARIABLE_TYPES = [
  "color",
  "size",
  "fluid-size",
  "font-family",
  "font-weight",
  "shadow",
  "radius",
  "number",
  "string"
] as const;
export const variableTypeSchema = z.enum(VARIABLE_TYPES);
export type VariableType = z.infer<typeof variableTypeSchema>;

export const VARIABLE_TYPE_LABEL: Record<VariableType, string> = {
  color: "Color",
  size: "Size",
  "fluid-size": "Fluid size",
  "font-family": "Font family",
  "font-weight": "Font weight",
  shadow: "Shadow",
  radius: "Radius",
  number: "Number",
  string: "Text"
};

// A fluid size grows from `min` to `max` (px) between two viewport widths (px).
export const fluidSizeSchema = z.object({
  min: z.number().min(0).max(2000),
  max: z.number().min(0).max(2000),
  minViewport: z.number().min(200).max(4000),
  maxViewport: z.number().min(200).max(4000)
});
export type FluidSize = z.infer<typeof fluidSizeSchema>;

// A value that could end the declaration or open another rule is refused.
export const SAFE_VALUE = /^[^{};<>]*$/;

export const variableSchema = z.object({
  name: z.string().regex(VARIABLE_NAME_PATTERN).max(48),
  type: variableTypeSchema,
  group: z.string().trim().min(1).max(48).default("General"),
  /** The CSS value. For fluid sizes it is derived from `fluid`. */
  value: z.string().trim().min(1).max(500).regex(SAFE_VALUE),
  fluid: fluidSizeSchema.optional()
});
export type ProjectVariable = z.infer<typeof variableSchema>;

export const variableListSchema = z
  .array(variableSchema)
  .max(1000)
  .refine((list) => new Set(list.map((v) => v.name)).size === list.length, {
    message: "Variable names must be unique."
  });

export const variableCssName = (name: string): string => `${VARIABLE_PREFIX}${name}`;
export const variableRef = (name: string): string => `var(${variableCssName(name)})`;

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** `clamp()` that grows linearly between the two viewports; sizes in px, output in rem. */
export function fluidClamp(f: FluidSize): string {
  const lo = Math.min(f.min, f.max);
  const hi = Math.max(f.min, f.max);
  const rem = (px: number) => round(px / 16);
  if (lo === hi) return `${rem(lo)}rem`;
  const span = Math.max(f.maxViewport - f.minViewport, 1);
  const slope = (f.max - f.min) / span;
  const intercept = f.min - slope * f.minViewport;
  const vw = round(Math.abs(slope) * 100);
  return `clamp(${rem(lo)}rem, ${rem(intercept)}rem ${slope < 0 ? "-" : "+"} ${vw}vw, ${rem(hi)}rem)`;
}

/** Builds a fluid-size variable whose value follows its fluid settings. */
export function fluidVariable(name: string, group: string, fluid: FluidSize): ProjectVariable {
  return { name, type: "fluid-size", group, value: fluidClamp(fluid), fluid };
}

export interface TypeScaleOptions {
  baseMin: number;
  baseMax: number;
  ratioMin: number;
  ratioMax: number;
  minViewport: number;
  maxViewport: number;
  stepsDown: number;
  stepsUp: number;
}

const UP_NAMES = ["l", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];
const DOWN_NAMES = ["s", "xs", "2xs", "3xs"];

/** Text sizes `text-3xs ... text-6xl` around `text-m`, each a fluid clamp. */
export function typeScale(o: TypeScaleOptions): ProjectVariable[] {
  const up = Math.min(o.stepsUp, UP_NAMES.length);
  const down = Math.min(o.stepsDown, DOWN_NAMES.length);
  const steps: [string, number][] = [
    ...DOWN_NAMES.slice(0, down).map((n, i): [string, number] => [n, -(i + 1)]),
    ["m", 0],
    ...UP_NAMES.slice(0, up).map((n, i): [string, number] => [n, i + 1])
  ];
  return steps
    .sort((a, b) => a[1] - b[1])
    .map(([name, k]) =>
      fluidVariable(`text-${name}`, "Typography", {
        min: round(o.baseMin * o.ratioMin ** k),
        max: round(o.baseMax * o.ratioMax ** k),
        minViewport: o.minViewport,
        maxViewport: o.maxViewport
      })
    );
}

export interface SpaceScaleOptions {
  baseMin: number;
  baseMax: number;
  minViewport: number;
  maxViewport: number;
}

const SPACE_STEPS: [string, number][] = [
  ["3xs", 0.25],
  ["2xs", 0.5],
  ["xs", 0.75],
  ["s", 1],
  ["m", 1.5],
  ["l", 2],
  ["xl", 3],
  ["2xl", 4],
  ["3xl", 6]
];

/** Spacing `space-3xs ... space-3xl`, multiples of the base, each a fluid clamp. */
export function spaceScale(o: SpaceScaleOptions): ProjectVariable[] {
  return SPACE_STEPS.map(([name, factor]) =>
    fluidVariable(`space-${name}`, "Spacing", {
      min: round(o.baseMin * factor),
      max: round(o.baseMax * factor),
      minViewport: o.minViewport,
      maxViewport: o.maxViewport
    })
  );
}

const HEX = /^#([0-9a-f]{6})$/i;
export const isHexColor = (value: string): boolean => HEX.test(value);

function hexToHsl(hex: string): [number, number, number] {
  const m = HEX.exec(hex);
  const n = parseInt(m?.[1] ?? "000000", 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SHADE_LIGHTNESS = [96, 91, 82, 71, 60, -1, 42, 34, 26, 18, 11];

/** Eleven shades (50 to 950) from a base color; shade 500 is the base itself. */
export function colorShades(name: string, base: string, group = "Colors"): ProjectVariable[] {
  const [h, s] = hexToHsl(base);
  return SHADES.map((shade, i) => {
    const l = SHADE_LIGHTNESS[i] ?? 50;
    const value = l < 0 ? base.toLowerCase() : hslToHex(h, s, l);
    return { name: `${name}-${shade}`, type: "color", group, value };
  });
}

/** `:root{--nxt-name:value;...}`; values the schema would refuse are skipped. */
export function variablesCss(variables: readonly ProjectVariable[]): string {
  const body = variables
    .filter((v) => SAFE_VALUE.test(v.value) && v.value.trim() !== "")
    .map((v) => `${variableCssName(v.name)}:${v.value}`)
    .join(";");
  return body ? `:root{${body}}` : "";
}

const refPattern = (name: string): RegExp =>
  new RegExp(String.raw`var\(\s*${variableCssName(name)}(?=[\s,)])`, "g");

/** Rewrites references to variable `from` (with or without a fallback) to `to` in one string. */
export function renameVariableRef(text: string, from: string, to: string): string {
  return text.replace(refPattern(from), `var(${variableCssName(to)}`);
}

/** How many times a variable is referenced in a string. */
export function countVariableRefs(text: string, name: string): number {
  return text.match(refPattern(name))?.length ?? 0;
}
