import { describe, expect, it } from "vitest";
import {
  applyScale,
  exportFrameworkCss,
  frameworkClasses,
  frameworkVariableMeta,
  importFrameworkCss,
  inferScales,
  scaleSteps,
  scopeFrameworkCss,
  DEFAULT_SCALES
} from "./framework";
import { frameworkStylesheet, mainFramework } from "./main-framework";
import { NO_COLOR_OPTIONS } from "./framework-colors";
import { newTheme, themeCss } from "./theme";

const SAMPLE = `
@import url("x.css");
:root { --primary: #123456; --space-m: clamp(1rem, 0.5rem + 2vw, 2rem); --min-screen-width: 320px; }
:root.theme-dark, .cf-theme-dark { --primary: #abcdef; }
.cf-theme-dark .card { color: white; }
.bg-primary { background-color: var(--primary); }
.padding-m { padding: var(--space-m); }
@media (max-width: 768px) { .hide-mobile { display: none; } }
`;

describe("scales", () => {
  it("base step equals the base size and steps follow the ratios", () => {
    const text = DEFAULT_SCALES[0]!;
    const steps = scaleSteps(text);
    const m = steps[text.baseIndex]!;
    expect(m.min).toBe(text.baseMin);
    expect(m.max).toBe(text.baseMax);
    expect(steps[text.baseIndex + 1]!.min).toBeCloseTo(text.baseMin * text.ratioMin, 2);
    expect(steps[text.baseIndex + 1]!.max).toBeCloseTo(text.baseMax * text.ratioMax, 2);
  });

  it("applyScale replaces variables and keeps others", () => {
    const fw = mainFramework();
    const next = applyScale(fw, { ...DEFAULT_SCALES[0]!, ratioMax: 1.5 });
    expect(next.variables.find((v) => v.name === "text-xl")!.value).not.toBe(
      fw.variables.find((v) => v.name === "text-xl")!.value
    );
    expect(next.variables.find((v) => v.name === "primary")).toBeDefined();
  });

  it("infers scale settings back from generated variables", () => {
    const fw = mainFramework();
    const inferred = inferScales(fw.variables).find((s) => s.prefix === "text")!;
    expect(inferred.baseIndex).toBe(2);
    expect(inferred.ratioMin).toBeCloseTo(1.125, 1);
    expect(inferred.ratioMax).toBeCloseTo(1.333, 1);
  });
});

describe("import and export", () => {
  it("splits variables, dark values and classes", () => {
    const r = importFrameworkCss(SAMPLE, "Sample");
    if ("error" in r) throw new Error(r.error);
    const primary = r.framework.variables.find((v) => v.name === "primary")!;
    expect(primary.value).toBe("#123456");
    expect(primary.dark).toBe("#abcdef");
    expect(r.framework.css).not.toContain("@import");
    expect(r.framework.css).toContain('[data-nxt-mode="dark"] .card');
    expect(frameworkClasses(r.framework.css).map((c) => c.name)).toEqual(
      expect.arrayContaining(["bg-primary", "padding-m", "hide-mobile"])
    );
  });

  it("rejects unsafe declarations", () => {
    const r = importFrameworkCss(".a{background:url(javascript:alert(1))}", "x");
    if ("error" in r) throw new Error(r.error);
    expect(r.framework.css).not.toContain("javascript");
  });

  it("returns an error for broken CSS", () => {
    expect("error" in importFrameworkCss(".a{", "x")).toBe(true);
  });

  it("round trips through export", () => {
    const first = importFrameworkCss(SAMPLE, "Sample");
    if ("error" in first) throw new Error(first.error);
    const again = importFrameworkCss(exportFrameworkCss(first.framework), "Sample");
    if ("error" in again) throw new Error(again.error);
    expect(again.framework.variables).toEqual(first.framework.variables);
    expect(frameworkClasses(again.framework.css)).toEqual(frameworkClasses(first.framework.css));
  });

  it("round trips the main framework scales", () => {
    const fw = mainFramework();
    const out = importFrameworkCss(exportFrameworkCss(fw, frameworkStylesheet(fw)), "Main");
    if ("error" in out) throw new Error(out.error);
    expect(out.framework.scales.map((s) => s.prefix)).toEqual(["text", "space", "radius"]);
    expect(out.framework.variables.length).toBe(fw.variables.length);
  });
});

describe("scoping and theme output", () => {
  it("scopes rules at zero specificity and keeps keyframes", () => {
    const css = scopeFrameworkCss(".a{color:red}:root{--x:1}@keyframes k{from{opacity:0}}", "main");
    expect(css).toContain(':where(:root[data-nxt-theme="main"]) .a');
    expect(css).toContain(':root[data-nxt-theme="main"]{--x:1}');
    expect(css).toContain("from");
  });

  it("themeCss emits framework variables, dark values and classes", () => {
    const fw = mainFramework();
    const theme = {
      ...newTheme("t1", "Main", []),
      darkMode: true,
      framework: {
        ...fw,
        variables: fw.variables.map((v) => (v.name === "primary" ? { ...v, dark: "#818cf8" } : v)),
        colorOptions: {
          ...fw.colorOptions,
          primary: { ...NO_COLOR_OPTIONS, utility: ["background-color" as const] }
        }
      }
    };
    const css = themeCss(theme);
    expect(css).toContain("--primary:#4f46e5");
    expect(css).toContain('[data-nxt-mode="dark"]{');
    expect(css).toContain(".bg-primary");
  });

  it("types variables for pickers", () => {
    expect(frameworkVariableMeta({ name: "primary", value: "#fff" }).type).toBe("color");
    expect(frameworkVariableMeta({ name: "space-m", value: "clamp(1rem, 2vw, 2rem)" }).type).toBe(
      "size"
    );
    expect(frameworkVariableMeta({ name: "space-m", value: "1rem" }).ref).toBe("var(--space-m)");
  });
});

describe("scale steps", () => {
  it("adds and removes steps at both ends and removes the variable", async () => {
    const { addScaleStep, removeScaleStep } = await import("./framework");
    const text = DEFAULT_SCALES[0]!;
    const up = addScaleStep(text, "larger");
    expect(up.names.at(-1)).toBe("5xl");
    const down = addScaleStep(text, "smaller");
    expect(down.names[0]).toBe("2xs");
    expect(down.baseIndex).toBe(text.baseIndex + 1);
    const fw = applyScale(mainFramework(), up);
    expect(fw.variables.some((v) => v.name === "text-5xl")).toBe(true);
    const back = applyScale(fw, removeScaleStep(up, "larger"));
    expect(back.variables.some((v) => v.name === "text-5xl")).toBe(false);
    expect(
      removeScaleStep({ ...text, names: ["a", "b", "c"], baseIndex: 1 }, "larger").names
    ).toHaveLength(3);
  });
});
