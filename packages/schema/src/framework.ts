import { parse, type ChildNode, type Rule } from "postcss";
import { z } from "zod";
import { SAFE_VALUE, fluidClamp } from "./variables";

// CSS frameworks (docs/design-system.md). Every theme owns one framework: a list of CSS custom
// properties (`--primary`, `--space-m`, light value plus optional dark value), a stylesheet of
// classes, and the settings of its fluid scales (text, space, radius). The default "main"
// framework is generated; an imported one keeps the stylesheet it came with. Frameworks import
// from and export to plain CSS, so Core Framework style files round trip.

export const FRAMEWORK_VAR_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const MAX_CSS = 2_000_000;

export const frameworkVariableSchema = z.object({
  /** Custom property name without the leading `--`. Written exactly as given, never prefixed. */
  name: z.string().regex(FRAMEWORK_VAR_PATTERN).max(64),
  value: z.string().trim().min(1).max(500).regex(SAFE_VALUE),
  /** Value in the dark color mode, when it differs. */
  dark: z.string().trim().min(1).max(500).regex(SAFE_VALUE).optional()
});
export type FrameworkVariable = z.infer<typeof frameworkVariableSchema>;

// A fluid scale: `names[baseIndex]` is the base step; each step away multiplies by the ratio, the
// minor ratio at the narrow screen and the major ratio at the wide one (like Core Framework).
export const scaleSchema = z.object({
  prefix: z.string().regex(FRAMEWORK_VAR_PATTERN).max(24),
  names: z
    .array(
      z
        .string()
        .regex(/^[A-Za-z0-9]+$/)
        .max(8)
    )
    .min(2)
    .max(16),
  baseIndex: z.number().int().min(0).max(15),
  baseMin: z.number().min(1).max(512),
  baseMax: z.number().min(1).max(512),
  ratioMin: z.number().min(1).max(3),
  ratioMax: z.number().min(1).max(3),
  minScreen: z.number().int().min(200).max(4000),
  maxScreen: z.number().int().min(200).max(4000)
});
export type ScaleSettings = z.infer<typeof scaleSchema>;

export const frameworkSchema = z.object({
  name: z.string().trim().min(1).max(64),
  source: z.enum(["main", "import"]),
  variables: z
    .array(frameworkVariableSchema)
    .max(2000)
    .refine((l) => new Set(l.map((v) => v.name)).size === l.length, {
      message: "Framework variable names must be unique."
    }),
  /** The stylesheet of classes. Empty for the main framework, whose classes are generated. */
  css: z.string().max(MAX_CSS).default(""),
  scales: z.array(scaleSchema).max(6).default([])
});
export type Framework = z.infer<typeof frameworkSchema>;

export const RATIO_PRESETS: { label: string; value: number }[] = [
  { label: "Minor second 1.067", value: 1.067 },
  { label: "Major second 1.125", value: 1.125 },
  { label: "Minor third 1.2", value: 1.2 },
  { label: "Major third 1.25", value: 1.25 },
  { label: "Perfect fourth 1.333", value: 1.333 },
  { label: "Augmented fourth 1.414", value: 1.414 },
  { label: "Perfect fifth 1.5", value: 1.5 },
  { label: "Golden ratio 1.618", value: 1.618 }
];

const round = (n: number): number => Math.round(n * 1000) / 1000;

// ---- Scales ------------------------------------------------------------------------------------

export const DEFAULT_SCALES: ScaleSettings[] = [
  {
    prefix: "text",
    names: ["xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl"],
    baseIndex: 2,
    baseMin: 16,
    baseMax: 18,
    ratioMin: 1.125,
    ratioMax: 1.333,
    minScreen: 320,
    maxScreen: 1400
  },
  {
    prefix: "space",
    names: ["4xs", "3xs", "2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl"],
    baseIndex: 5,
    baseMin: 16,
    baseMax: 28,
    ratioMin: 1.25,
    ratioMax: 1.414,
    minScreen: 320,
    maxScreen: 1400
  },
  {
    prefix: "radius",
    names: ["xs", "s", "m", "l", "xl"],
    baseIndex: 2,
    baseMin: 10,
    baseMax: 12,
    ratioMin: 1.6,
    ratioMax: 1.667,
    minScreen: 320,
    maxScreen: 1400
  }
];

export interface ScaleStep {
  name: string;
  variable: string;
  min: number;
  max: number;
  value: string;
}

/** Every step of a scale as a `clamp()` between two screen widths. */
export function scaleSteps(s: ScaleSettings): ScaleStep[] {
  return s.names.map((name, i) => {
    const k = i - s.baseIndex;
    const min = round(s.baseMin * s.ratioMin ** k);
    const max = round(s.baseMax * s.ratioMax ** k);
    return {
      name,
      variable: `${s.prefix}-${name}`,
      min,
      max,
      value: fluidClamp({ min, max, minViewport: s.minScreen, maxViewport: s.maxScreen })
    };
  });
}

/** The framework with this scale's variables set (replacing their values, keeping their order). */
export function applyScale(fw: Framework, scale: ScaleSettings): Framework {
  const steps = new Map(scaleSteps(scale).map((s) => [s.variable, s.value]));
  const seen = new Set<string>();
  const variables = fw.variables.map((v) => {
    const value = steps.get(v.name);
    if (value === undefined) return v;
    seen.add(v.name);
    return { name: v.name, value };
  });
  for (const [name, value] of steps) if (!seen.has(name)) variables.push({ name, value });
  const scales = fw.scales.some((s) => s.prefix === scale.prefix)
    ? fw.scales.map((s) => (s.prefix === scale.prefix ? scale : s))
    : [...fw.scales, scale];
  return { ...fw, variables, scales };
}

const CLAMP = /^clamp\(\s*(-?[\d.]+)(rem|px)\s*,[\s\S]*,\s*(-?[\d.]+)(rem|px)\s*\)$/i;
const toPx = (n: string, unit: string): number =>
  parseFloat(n) * (unit.toLowerCase() === "rem" ? 16 : 1);

function screenWidth(vars: readonly FrameworkVariable[], name: string, fallback: number): number {
  const v = vars.find((x) => x.name === name)?.value.trim() ?? "";
  const m = /^([\d.]+)px$/.exec(v);
  const n = m ? Math.round(parseFloat(m[1] ?? "")) : NaN;
  return n >= 200 && n <= 4000 ? n : fallback;
}

/**
 * Reads the fluid scales out of variables written as `--text-m: clamp(...)`, so an imported
 * framework gets the same ratio and base controls as a generated one.
 */
export function inferScales(vars: readonly FrameworkVariable[]): ScaleSettings[] {
  const minScreen = screenWidth(vars, "min-screen-width", 320);
  const maxScreen = screenWidth(vars, "max-screen-width", 1400);
  const out: ScaleSettings[] = [];
  for (const prefix of ["text", "space", "radius"]) {
    const steps = vars.flatMap((v) => {
      const m = new RegExp(`^${prefix}-([A-Za-z0-9]{1,8})$`).exec(v.name);
      const c = CLAMP.exec(v.value.trim());
      if (!m || !c) return [];
      return [
        {
          name: m[1] ?? "",
          min: toPx(c[1] ?? "0", c[2] ?? "px"),
          max: toPx(c[3] ?? "0", c[4] ?? "px")
        }
      ];
    });
    if (steps.length < 2) continue;
    const named = steps.findIndex((s) => s.name === "m");
    const baseIndex = named >= 0 ? named : Math.floor(steps.length / 2);
    const base = steps[baseIndex];
    const next = steps[baseIndex + 1];
    const prev = steps[baseIndex - 1];
    if (!base || base.min <= 0 || base.max <= 0) continue;
    const ratio = (a: number, b: number): number =>
      a > 0 && b > 0 ? Math.max(1, round(a / b)) : 1.2;
    const defaults = DEFAULT_SCALES.find((d) => d.prefix === prefix);
    const clampRatio = (r: number): number => Math.min(3, Math.max(1, r));
    out.push(
      scaleSchema.parse({
        prefix,
        names: steps.map((s) => s.name),
        baseIndex,
        baseMin: round(base.min),
        baseMax: round(base.max),
        ratioMin: clampRatio(
          next
            ? ratio(next.min, base.min)
            : prev
              ? ratio(base.min, prev.min)
              : (defaults?.ratioMin ?? 1.2)
        ),
        ratioMax: clampRatio(
          next
            ? ratio(next.max, base.max)
            : prev
              ? ratio(base.max, prev.max)
              : (defaults?.ratioMax ?? 1.333)
        ),
        minScreen,
        maxScreen
      })
    );
  }
  return out;
}

// ---- Variable meta (for pickers and lists) -------------------------------------------------------

const COLOR_VALUE = /^(#[0-9a-f]{3,8}\b|(?:hsl|rgb|hwb|lab|lch|oklab|oklch|color)a?\()/i;
export const isColorValue = (value: string): boolean => COLOR_VALUE.test(value.trim());

export interface FrameworkVariableMeta {
  name: string;
  /** The custom property as written in CSS: `--primary`. */
  cssName: string;
  /** What a style value stores to use it: `var(--primary)`. */
  ref: string;
  type: "color" | "size" | "shadow" | "string";
  group: string;
  value: string;
}

/** Type and group of a framework variable, guessed from its value and name. */
export function frameworkVariableMeta(v: FrameworkVariable): FrameworkVariableMeta {
  const type = isColorValue(v.value)
    ? "color"
    : /^shadow(-|$)/.test(v.name) ||
        (/\d+px\s+\S+/.test(v.value) && /(hsla?|rgba?|#)/i.test(v.value))
      ? "shadow"
      : /^(-?[\d.]+(px|rem|em|vw|vh|%)|clamp\(|calc\()/i.test(v.value.trim())
        ? "size"
        : "string";
  const first = v.name.split("-")[0] ?? v.name;
  const group = first.charAt(0).toUpperCase() + first.slice(1);
  return {
    name: v.name,
    cssName: `--${v.name}`,
    ref: `var(--${v.name})`,
    type,
    group,
    value: v.value
  };
}

// ---- Import --------------------------------------------------------------------------------------

export interface ImportReport {
  variables: number;
  darkVariables: number;
  classes: number;
  scales: string[];
  warnings: string[];
}

const UNSAFE_DECL = /javascript:|expression\(|<\/?script|@import|\/\*|\*\//i;
const ROOT_BASE = /^(?::root|html)$/;
const ROOT_DARK = /^(?::root|html)(?:\.[\w-]*dark[\w-]*|\[[^\]]*dark[^\]]*\])$/i;
const ROOT_LIGHT = /^(?::root|html)(?:\.[\w-]*light[\w-]*|\[[^\]]*light[^\]]*\])$/i;
const SCALES_COMMENT = /\/\*\s*nextomic:scales\s+(\{[\s\S]*?\})\s*\*\//;

function isVariableRule(rule: Rule): boolean {
  const decls = (rule.nodes ?? []).filter(
    (n): n is ChildNode & { type: "decl" } => n.type === "decl"
  );
  return (
    decls.length > 0 &&
    decls.length === (rule.nodes ?? []).filter((n) => n.type !== "comment").length &&
    decls.every((d) => d.prop.startsWith("--"))
  );
}

/** `.cf-theme-dark`, `.theme-dark` and friends become this app's color-mode attribute. */
export function normalizeModeSelectors(selector: string): string {
  return selector
    .replace(/\.(?:cf-)?theme-dark\b/g, '[data-nxt-mode="dark"]')
    .replace(/\.(?:cf-)?theme-light\b/g, '[data-nxt-mode="light"]');
}

/**
 * Reads a CSS framework file. Rules that only hold custom properties on `:root` become variables
 * (a `.dark` style root rule gives the dark values); every other rule stays in the stylesheet with
 * its color-mode selectors normalised. `@import` and `@font-face` are dropped, and anything that
 * could run script is removed.
 */
export function importFrameworkCss(
  source: string,
  name: string
): { framework: Framework; report: ImportReport } | { error: string } {
  if (source.length > MAX_CSS) return { error: "The file is larger than 2 MB." };
  let root;
  try {
    root = parse(source);
  } catch {
    return { error: "That is not valid CSS." };
  }
  const warnings: string[] = [];
  const saved = SCALES_COMMENT.exec(source)?.[1];
  const variables = new Map<string, FrameworkVariable>();
  let dropped = 0;
  let skippedVars = 0;
  let unsafe = 0;

  const setVar = (prop: string, value: string, dark: boolean): void => {
    const n = prop.slice(2);
    const v = value.trim();
    if (
      !FRAMEWORK_VAR_PATTERN.test(n) ||
      n.length > 64 ||
      v === "" ||
      v.length > 500 ||
      !SAFE_VALUE.test(v)
    ) {
      skippedVars += 1;
      return;
    }
    const current = variables.get(n);
    if (dark) variables.set(n, { name: n, value: current?.value ?? v, dark: v });
    else variables.set(n, { name: n, value: v, ...(current?.dark ? { dark: current.dark } : {}) });
  };

  root.each((node) => {
    if (node.type === "comment") {
      node.remove();
      return;
    }
    if (node.type === "atrule" && /^(import|charset|font-face|namespace)$/i.test(node.name)) {
      warnings.push(`Removed @${node.name}.`);
      node.remove();
      return;
    }
    if (node.type !== "rule" || !isVariableRule(node)) return;
    const selectors = node.selectors.map((s) => s.trim());
    const base = selectors.some((s) => ROOT_BASE.test(s) || ROOT_LIGHT.test(s));
    const dark = selectors.some((s) => ROOT_DARK.test(s));
    if (!base && !dark) return;
    node.walkDecls((d) => setVar(d.prop, d.value, dark && !base));
    dropped += selectors.filter(
      (s) => !ROOT_BASE.test(s) && !ROOT_DARK.test(s) && !ROOT_LIGHT.test(s)
    ).length;
    node.remove();
  });

  root.walkRules((rule) => {
    rule.selectors = rule.selectors.map(normalizeModeSelectors);
  });
  root.walkDecls((d) => {
    if (UNSAFE_DECL.test(d.value) || UNSAFE_DECL.test(d.prop)) {
      unsafe += 1;
      d.remove();
    }
  });
  const css = root.toString().trim();
  if (dropped > 0)
    warnings.push(
      `${dropped} nested color-mode selector${dropped === 1 ? " was" : "s were"} dropped from the variable blocks.`
    );
  if (skippedVars > 0)
    warnings.push(
      `${skippedVars} variable${skippedVars === 1 ? "" : "s"} with unsupported names or values skipped.`
    );
  if (unsafe > 0) warnings.push(`${unsafe} unsafe declaration${unsafe === 1 ? "" : "s"} removed.`);

  const list = [...variables.values()].slice(0, 2000);
  let scales: ScaleSettings[] = inferScales(list);
  if (saved) {
    try {
      const parsed = z.array(scaleSchema).max(6).safeParse(JSON.parse(saved));
      if (parsed.success) scales = parsed.data;
    } catch {
      // The comment is only a hint; inference above already ran.
    }
  }
  const framework = frameworkSchema.parse({
    name: name.trim().slice(0, 64) || "Imported framework",
    source: "import",
    variables: list,
    css,
    scales
  });
  return {
    framework,
    report: {
      variables: list.length,
      darkVariables: list.filter((v) => v.dark !== undefined).length,
      classes: frameworkClasses(css).length,
      scales: scales.map((s) => s.prefix),
      warnings
    }
  };
}

// ---- Output --------------------------------------------------------------------------------------

function varBlock(selector: string, vars: { name: string; value: string }[]): string {
  if (vars.length === 0) return "";
  return `${selector}{${vars.map((v) => `--${v.name}:${v.value}`).join(";")}}`;
}

const cache = new Map<string, string>();
function memo(key: string, make: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = make();
  cache.set(key, value);
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  return value;
}

function scopeSelector(selector: string, scope: string): string {
  const s = selector.trim();
  const rooted = /^(?::root|html)(?![\w-])/.exec(s);
  if (rooted) return `${scope}${s.slice(rooted[0].length)}`;
  return `:where(${scope}) ${s}`;
}

/**
 * The framework stylesheet limited to one theme: rules on `:root` or `html` gain the theme
 * attribute, everything else sits under a zero-specificity `:where(:root[data-nxt-theme])`, so a
 * class or element style set in the builder always wins over a framework class.
 */
export function scopeFrameworkCss(css: string, slug: string): string {
  if (css.trim() === "") return "";
  return memo(`scope\u0000${slug}\u0000${css}`, () => {
    let root;
    try {
      root = parse(css);
    } catch {
      return "";
    }
    const scope = `:root[data-nxt-theme="${slug}"]`;
    root.walkRules((rule) => {
      const parent = rule.parent;
      if (
        parent &&
        parent.type === "atrule" &&
        /keyframes$/i.test((parent as { name: string }).name)
      )
        return;
      rule.selectors = rule.selectors.map((s) => scopeSelector(s, scope));
    });
    return root.toString().replace(/\s+/g, " ").trim();
  });
}

/** Variable blocks of a framework for a theme: light/base values, then dark values when the theme has a dark mode. */
export function frameworkVariablesCss(fw: Framework, slug: string, hasDark: boolean): string {
  const root = `:root[data-nxt-theme="${slug}"]`;
  const dark = hasDark
    ? varBlock(
        `${root}[data-nxt-mode="dark"]`,
        fw.variables.flatMap((v) => (v.dark !== undefined ? [{ name: v.name, value: v.dark }] : []))
      )
    : "";
  return varBlock(root, fw.variables) + dark;
}

/** The framework as a stylesheet file: variables, dark variables, the scale settings, then the classes. */
export function exportFrameworkCss(fw: Framework, generatedClasses = ""): string {
  const light = fw.variables.map((v) => `  --${v.name}: ${v.value};`).join("\n");
  const dark = fw.variables
    .flatMap((v) => (v.dark !== undefined ? [`  --${v.name}: ${v.dark};`] : []))
    .join("\n");
  const parts = [
    `/* ${fw.name} - exported from Nextomic */`,
    fw.scales.length > 0 ? `/* nextomic:scales ${JSON.stringify(fw.scales)} */` : "",
    light ? `:root {\n${light}\n}` : "",
    dark ? `:root[data-nxt-mode="dark"] {\n${dark}\n}` : "",
    (fw.css || generatedClasses).trim()
  ];
  return parts.filter(Boolean).join("\n") + "\n";
}

// ---- Classes -------------------------------------------------------------------------------------

export interface FrameworkClass {
  name: string;
  group: string;
}

/** Classes named in the stylesheet's selectors, grouped by their first word (bg, text, padding ...). */
export function frameworkClasses(css: string): FrameworkClass[] {
  if (css.trim() === "") return [];
  let root;
  try {
    root = parse(css);
  } catch {
    return [];
  }
  const names = new Set<string>();
  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent && parent.type === "atrule" && /keyframes$/i.test((parent as { name: string }).name))
      return;
    for (const m of rule.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (m[1]) names.add(m[1]);
  });
  return [...names].sort().map((name) => {
    const first = name.includes("-") ? (name.split("-")[0] ?? name) : "";
    const group =
      first && /^[a-z]+$/.test(first)
        ? first.charAt(0).toUpperCase() + first.slice(1)
        : "Components";
    return { name, group };
  });
}

/** The rules of one class, as written in the stylesheet (for the class list preview). */
export function frameworkClassRules(css: string, className: string): string {
  let root;
  try {
    root = parse(css);
  } catch {
    return "";
  }
  const re = new RegExp(String.raw`\.${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\w-])`);
  const out: string[] = [];
  root.walkRules((rule) => {
    if (re.test(rule.selector) && out.length < 12) out.push(rule.toString());
  });
  return out.join("\n");
}
