import {
  DEFAULT_SCALES,
  colorUtilityCss,
  NO_COLOR_OPTIONS,
  type ColorOptions,
  applyScale,
  frameworkSchema,
  type Framework,
  type FrameworkVariable
} from "./framework";

// The "Main" framework every new project starts with (docs/design-system.md): modern neutral
// colors with shades, fluid text/space/radius scales, shadows, and a small set of utility and
// component classes. Its stylesheet is generated here, not stored, so it stays editable through
// the scale and variable controls only.

interface ColorDef {
  name: string;
  group: string;
  light: string;
  options: ColorOptions;
}

// Every color starts with all shades and utility classes off; the user turns on what the site needs.
const BRAND_OPTIONS: ColorOptions = NO_COLOR_OPTIONS;
const only = (_property: ColorOptions["utility"][number]): ColorOptions => NO_COLOR_OPTIONS;

const COLORS: ColorDef[] = [
  { name: "primary", group: "Brand", light: "#4f46e5", options: BRAND_OPTIONS },
  { name: "secondary", group: "Brand", light: "#0f172a", options: BRAND_OPTIONS },
  { name: "accent", group: "Brand", light: "#06b6d4", options: BRAND_OPTIONS },
  { name: "success", group: "Status", light: "#16a34a", options: BRAND_OPTIONS },
  { name: "warning", group: "Status", light: "#f59e0b", options: BRAND_OPTIONS },
  { name: "danger", group: "Status", light: "#dc2626", options: BRAND_OPTIONS },
  { name: "info", group: "Status", light: "#2563eb", options: BRAND_OPTIONS },
  { name: "bg", group: "Surface", light: "#ffffff", options: only("background-color") },
  { name: "bg-alt", group: "Surface", light: "#f8fafc", options: only("background-color") },
  { name: "surface", group: "Surface", light: "#ffffff", options: only("background-color") },
  { name: "text", group: "Surface", light: "#0f172a", options: only("color") },
  { name: "text-muted", group: "Surface", light: "#475569", options: only("color") },
  { name: "border", group: "Surface", light: "#e2e8f0", options: only("border-color") }
];

function colorVariables(): FrameworkVariable[] {
  return COLORS.map((c) => ({
    name: c.name,
    value: c.light,
    group: c.group
  }));
}

/**
 * The Main framework ships no classes: a new theme gets colors and scales only, and the user adds
 * the classes they want (color utility classes are generated from the color options).
 */
export function mainFrameworkCss(_fw: Framework): string {
  return "";
}

/** A new Main framework. */
export function mainFramework(): Framework {
  let fw: Framework = frameworkSchema.parse({
    name: "Main framework",
    source: "main",
    variables: [...colorVariables()],
    css: "",
    scales: [],
    colorOptions: Object.fromEntries(COLORS.map((c) => [c.name, c.options]))
  });
  for (const scale of DEFAULT_SCALES) fw = applyScale(fw, scale);
  return fw;
}

/** The stylesheet to apply or export: stored css for imports, generated for the main framework. */
export function frameworkStylesheet(fw: Framework): string {
  return (fw.source === "main" ? mainFrameworkCss(fw) : fw.css) + colorUtilityCss(fw);
}
