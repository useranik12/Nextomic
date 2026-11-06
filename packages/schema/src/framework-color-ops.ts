import {
  FRAMEWORK_VAR_PATTERN,
  frameworkSchema,
  isBaseColor,
  looksLikeColor,
  NO_COLOR_OPTIONS,
  type ColorOptions,
  type Framework,
  type FrameworkVariable
} from "./framework";
import { renameCssVarRefs } from "./variable-refs";
import { shadesOf } from "./framework-colors";

// Edits of the colors of a framework, as pure functions (used by the Colors manager and tested
// on their own). Every function returns a new framework or an error message.

export const DEFAULT_COLOR_GROUP = "Colors";

export type ColorResult = { framework: Framework } | { error: string };

export interface FrameworkColor {
  name: string;
  value: string;
  dark?: string;
  group: string;
  options: ColorOptions;
}

export const colorGroupOf = (v: FrameworkVariable): string => v.group ?? DEFAULT_COLOR_GROUP;

/** The colors of a framework (variables whose value is a color, shades of other colors left out). */
export function frameworkColors(fw: Framework): FrameworkColor[] {
  return fw.variables
    .filter((v) => isBaseColor(v, fw.variables))
    .map((v) => ({
      name: v.name,
      value: v.value,
      ...(v.dark !== undefined ? { dark: v.dark } : {}),
      group: colorGroupOf(v),
      options: fw.colorOptions[v.name] ?? NO_COLOR_OPTIONS
    }));
}

/** Palette names: those with colors (in order of appearance) and the empty ones the user made. */
export function colorGroups(fw: Framework): string[] {
  const out: string[] = [];
  for (const c of frameworkColors(fw)) if (!out.includes(c.group)) out.push(c.group);
  for (const g of fw.colorGroups) if (!out.includes(g)) out.push(g);
  return out;
}

const valid = (fw: Framework): ColorResult => {
  const parsed = frameworkSchema.safeParse(fw);
  return parsed.success
    ? { framework: parsed.data }
    : { error: parsed.error.issues[0]?.message ?? "Invalid framework." };
};

const SHADE_SUFFIX = /-(?:l|d)-\d{1,2}$|-t-\d{2}$/;

const shadeTaken = (fw: Framework, name: string): boolean =>
  Object.keys(fw.colorOptions).some(
    (base) => name.startsWith(`${base}-`) && SHADE_SUFFIX.test(name)
  );

export function validateColorName(fw: Framework, name: string, except?: string): string | null {
  if (!FRAMEWORK_VAR_PATTERN.test(name) || name.length > 64)
    return "Use letters, digits, - and _, starting with a letter.";
  if (name !== except && (fw.variables.some((v) => v.name === name) || shadeTaken(fw, name)))
    return "That name is taken.";
  return null;
}

export function addColor(
  fw: Framework,
  input: { name: string; value: string; group: string }
): ColorResult {
  const name = input.name.trim();
  const problem = validateColorName(fw, name);
  if (problem) return { error: problem };
  if (!looksLikeColor(input.value)) return { error: "Enter a color, for example #4f46e5." };
  return valid({
    ...fw,
    variables: [...fw.variables, { name, value: input.value.trim(), group: input.group }]
  });
}

export function setColorValue(
  fw: Framework,
  name: string,
  key: "value" | "dark",
  value: string | null
): ColorResult {
  return valid({
    ...fw,
    variables: fw.variables.map((v) => {
      if (v.name !== name) return v;
      if (key === "dark") {
        const { dark: _drop, ...rest } = v;
        return value === null || value.trim() === "" ? rest : { ...rest, dark: value.trim() };
      }
      return value && value.trim() !== "" ? { ...v, value: value.trim() } : v;
    })
  });
}

export function setColorOptions(fw: Framework, name: string, options: ColorOptions): ColorResult {
  return valid({ ...fw, colorOptions: { ...fw.colorOptions, [name]: options } });
}

export function renameColor(fw: Framework, from: string, to: string): ColorResult {
  if (from === to) return { framework: fw };
  const problem = validateColorName(fw, to);
  if (problem) return { error: problem };
  const { [from]: options, ...otherOptions } = fw.colorOptions;
  return valid({
    ...fw,
    variables: fw.variables.map((v) => (v.name === from ? { ...v, name: to } : v)),
    colorOptions: options ? { ...otherOptions, [to]: options } : otherOptions
  });
}

export function removeColor(fw: Framework, name: string): Framework {
  const { [name]: _gone, ...colorOptions } = fw.colorOptions;
  return { ...fw, variables: fw.variables.filter((v) => v.name !== name), colorOptions };
}

export function moveColor(fw: Framework, name: string, group: string): ColorResult {
  return valid({
    ...fw,
    variables: fw.variables.map((v) => (v.name === name ? { ...v, group } : v))
  });
}

const GROUP_PROBLEM = "Give the palette a name (up to 48 characters).";

export function addColorGroup(fw: Framework, group: string): ColorResult {
  const name = group.trim();
  if (name === "" || name.length > 48) return { error: GROUP_PROBLEM };
  if (colorGroups(fw).some((g) => g.toLowerCase() === name.toLowerCase()))
    return { error: "A palette with that name exists." };
  return valid({ ...fw, colorGroups: [...fw.colorGroups, name] });
}

export function renameColorGroup(fw: Framework, from: string, to: string): ColorResult {
  const name = to.trim();
  if (name === from) return { framework: fw };
  if (name === "" || name.length > 48) return { error: GROUP_PROBLEM };
  if (colorGroups(fw).some((g) => g.toLowerCase() === name.toLowerCase() && g !== from))
    return { error: "A palette with that name exists." };
  return valid({
    ...fw,
    variables: fw.variables.map((v) =>
      colorGroupOf(v) === from && isBaseColor(v, fw.variables) ? { ...v, group: name } : v
    ),
    colorGroups: fw.colorGroups.map((g) => (g === from ? name : g))
  });
}

/** Removes a palette and its colors. */
export function removeColorGroup(fw: Framework, group: string): Framework {
  const names = frameworkColors(fw)
    .filter((c) => c.group === group)
    .map((c) => c.name);
  let next: Framework = { ...fw, colorGroups: fw.colorGroups.filter((g) => g !== group) };
  for (const n of names) next = removeColor(next, n);
  return next;
}

export type CssVarPairs = [from: string, to: string][];

/** `from, to` pairs for renaming a color, including the shades its options generate. */
export function colorRenamePairs(fw: Framework, from: string, to: string): CssVarPairs {
  const pairs: CssVarPairs = [[from, to]];
  const options = fw.colorOptions[from];
  if (options) for (const s of shadesOf(from, options)) pairs.push([s.name, `${to}-${s.suffix}`]);
  return pairs;
}

/** Rewrites `var(--x)` references inside the framework itself (variable values and class CSS). */
export function renameInFramework(fw: Framework, pairs: CssVarPairs): Framework {
  const map = new Map(pairs);
  const text = (value: string) => renameCssVarRefs(value, map);
  return {
    ...fw,
    css: text(fw.css),
    variables: fw.variables.map((v) => ({
      ...v,
      value: text(v.value),
      ...(v.dark !== undefined ? { dark: text(v.dark) } : {})
    })),
    colorOptions: Object.fromEntries(
      Object.entries(fw.colorOptions).map(([name, o]) => [
        name,
        {
          ...o,
          overrides: Object.fromEntries(Object.entries(o.overrides).map(([k, v]) => [k, text(v)]))
        }
      ])
    )
  };
}

export type PrefixResult = { framework: Framework; renames: CssVarPairs } | { error: string };

/**
 * Gives every color of the framework the prefix: the old prefix is removed from the start of a
 * name and the new one added. Returns the pairs of names that changed (shades included), so the
 * references in pages, classes and variables can follow.
 */
export function applyColorPrefix(fw: Framework, prefix: string): PrefixResult {
  const next = prefix.trim();
  if (next !== "" && !FRAMEWORK_VAR_PATTERN.test(`${next}x`))
    return { error: "Use letters, digits, - and _, starting with a letter." };
  const old = fw.colorPrefix;
  const stem = (name: string) =>
    old !== "" && name.startsWith(old) && name.length > old.length ? name.slice(old.length) : name;
  const colors = frameworkColors(fw);
  const moving = new Map(colors.map((c) => [c.name, `${next}${stem(c.name)}`]));
  const targets = [...moving.values()];
  if (new Set(targets).size !== targets.length)
    return { error: "Two colors would get the same name." };
  const fixed = new Set(fw.variables.filter((v) => !moving.has(v.name)).map((v) => v.name));
  const clash = targets.find((t) => fixed.has(t));
  if (clash) return { error: `${clash} is already a variable that is not a color.` };
  const bad = targets.find((t) => !FRAMEWORK_VAR_PATTERN.test(t) || t.length > 64);
  if (bad) return { error: `${bad} is not a valid name.` };
  const renames: CssVarPairs = [];
  for (const c of colors) {
    const to = moving.get(c.name) ?? c.name;
    if (to !== c.name) renames.push(...colorRenamePairs(fw, c.name, to));
  }
  const rename = new Map(renames);
  const renamed: Framework = {
    ...fw,
    colorPrefix: next,
    variables: fw.variables.map((v) =>
      rename.has(v.name) ? { ...v, name: rename.get(v.name) ?? v.name } : v
    ),
    colorOptions: Object.fromEntries(
      Object.entries(fw.colorOptions).map(([n, o]) => [moving.get(n) ?? n, o])
    )
  };
  const result = valid(renameInFramework(renamed, renames));
  return "error" in result ? result : { framework: result.framework, renames };
}
