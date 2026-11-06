import {
  DEFAULT_SCALES,
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
  light: string;
  dark?: string;
}

const COLORS: ColorDef[] = [
  { name: "primary", light: "#4f46e5", dark: "#818cf8" },
  { name: "secondary", light: "#0f172a", dark: "#e2e8f0" },
  { name: "accent", light: "#06b6d4", dark: "#22d3ee" },
  { name: "success", light: "#16a34a", dark: "#4ade80" },
  { name: "warning", light: "#f59e0b", dark: "#fbbf24" },
  { name: "danger", light: "#dc2626", dark: "#f87171" },
  { name: "info", light: "#2563eb", dark: "#60a5fa" }
];

const SURFACES: ColorDef[] = [
  { name: "bg", light: "#ffffff", dark: "#0b0f19" },
  { name: "bg-alt", light: "#f8fafc", dark: "#111827" },
  { name: "surface", light: "#ffffff", dark: "#161e2e" },
  { name: "text", light: "#0f172a", dark: "#e5e7eb" },
  { name: "text-muted", light: "#475569", dark: "#9ca3af" },
  { name: "border", light: "#e2e8f0", dark: "#273245" }
];

const mix = (name: string, pct: number, to: "black" | "white"): string =>
  `color-mix(in srgb, var(--${name}) ${pct}%, ${to})`;
const alpha = (name: string, pct: number): string =>
  `color-mix(in srgb, var(--${name}) ${pct}%, transparent)`;

function colorVariables(): FrameworkVariable[] {
  const out: FrameworkVariable[] = [];
  for (const c of [...COLORS, ...SURFACES]) {
    out.push({ name: c.name, value: c.light, ...(c.dark ? { dark: c.dark } : {}) });
  }
  for (const c of COLORS) {
    out.push(
      { name: `${c.name}-d-1`, value: mix(c.name, 85, "black") },
      { name: `${c.name}-d-2`, value: mix(c.name, 70, "black") },
      { name: `${c.name}-l-1`, value: mix(c.name, 85, "white") },
      { name: `${c.name}-l-2`, value: mix(c.name, 70, "white") },
      { name: `${c.name}-l-3`, value: mix(c.name, 15, "white") },
      { name: `${c.name}-a-10`, value: alpha(c.name, 10) },
      { name: `${c.name}-a-20`, value: alpha(c.name, 20) },
      { name: `${c.name}-a-50`, value: alpha(c.name, 50) }
    );
  }
  return out;
}

const OTHER: FrameworkVariable[] = [
  { name: "min-screen-width", value: "320px" },
  { name: "max-screen-width", value: "1400px" },
  { name: "content-width", value: "1200px" },
  {
    name: "shadow-s",
    value: "0 1px 2px 0 rgb(15 23 42 / 0.08)",
    dark: "0 1px 2px 0 rgb(0 0 0 / 0.5)"
  },
  {
    name: "shadow-m",
    value: "0 4px 12px -2px rgb(15 23 42 / 0.12)",
    dark: "0 4px 12px -2px rgb(0 0 0 / 0.55)"
  },
  {
    name: "shadow-l",
    value: "0 16px 32px -8px rgb(15 23 42 / 0.18)",
    dark: "0 16px 32px -8px rgb(0 0 0 / 0.6)"
  },
  { name: "transition", value: "200ms ease" }
];

const SPACING_PROPS: [string, string[]][] = [
  ["padding", ["padding"]],
  ["padding-x", ["padding-left", "padding-right"]],
  ["padding-y", ["padding-top", "padding-bottom"]],
  ["margin", ["margin"]],
  ["margin-x", ["margin-left", "margin-right"]],
  ["margin-y", ["margin-top", "margin-bottom"]],
  ["gap", ["gap"]]
];

/** The utility and component classes of the Main framework, from its variables. */
export function mainFrameworkCss(fw: Framework): string {
  const names = new Set(fw.variables.map((v) => v.name));
  const has = (n: string): boolean => names.has(n);
  const out: string[] = [];
  const rule = (selector: string, body: string): void => {
    out.push(`${selector}{${body}}`);
  };
  const colorNames = [...COLORS, ...SURFACES].map((c) => c.name).filter(has);
  for (const c of colorNames) {
    rule(`.bg-${c}`, `background-color:var(--${c})`);
    rule(`.text-${c}`, `color:var(--${c})`);
    rule(`.border-${c}`, `border-color:var(--${c})`);
  }
  for (const s of fw.scales) {
    for (const name of s.names) {
      const v = `var(--${s.prefix}-${name})`;
      if (s.prefix === "text") rule(`.text-${name}`, `font-size:${v}`);
      if (s.prefix === "radius") rule(`.radius-${name}`, `border-radius:${v}`);
      if (s.prefix === "space") {
        for (const [cls, props] of SPACING_PROPS) {
          rule(`.${cls}-${name}`, props.map((p) => `${p}:${v}`).join(";"));
        }
      }
    }
  }
  for (const n of ["s", "m", "l"])
    if (has(`shadow-${n}`)) rule(`.shadow-${n}`, `box-shadow:var(--shadow-${n})`);
  rule(".flex", "display:flex");
  rule(".flex-row", "flex-direction:row");
  rule(".flex-column", "flex-direction:column");
  rule(".flex-wrap", "flex-wrap:wrap");
  rule(".grid", "display:grid");
  rule(".items-center", "align-items:center");
  rule(".justify-center", "justify-content:center");
  rule(".justify-between", "justify-content:space-between");
  rule(".text-center", "text-align:center");
  rule(
    ".container",
    "width:100%;max-width:var(--content-width,1200px);margin-inline:auto;padding-inline:var(--space-m,1rem)"
  );
  rule(".hidden", "display:none");
  rule(
    ".card",
    "background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-m,0.75rem);padding:var(--space-m,1rem);box-shadow:var(--shadow-s)"
  );
  rule(
    ".btn",
    "display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2xs,0.5rem);padding:var(--space-xs,0.5rem) var(--space-s,1rem);border-radius:var(--radius-s,0.5rem);border:1px solid transparent;font-weight:600;cursor:pointer;transition:background-color var(--transition),color var(--transition)"
  );
  rule(".btn--primary", "background:var(--primary);color:var(--bg)");
  rule(".btn--primary:hover", "background:var(--primary-d-1)");
  rule(".btn--outline", "border-color:var(--border);color:var(--text);background:transparent");
  rule(".btn--outline:hover", "background:var(--bg-alt)");
  return out.join("");
}

/** A new Main framework. */
export function mainFramework(): Framework {
  let fw: Framework = frameworkSchema.parse({
    name: "Main framework",
    source: "main",
    variables: [...colorVariables(), ...OTHER],
    css: "",
    scales: []
  });
  for (const scale of DEFAULT_SCALES) fw = applyScale(fw, scale);
  return fw;
}

/** The stylesheet to apply or export: stored css for imports, generated for the main framework. */
export function frameworkStylesheet(fw: Framework): string {
  return fw.source === "main" ? mainFrameworkCss(fw) : fw.css;
}
