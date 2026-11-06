import { describe, expect, it } from "vitest";
import { NO_COLOR_OPTIONS } from "./framework-colors";
import {
  colorUtilityCss,
  derivedColorVariables,
  exportFrameworkCss,
  frameworkClasses,
  frameworkVariablesCss,
  importFrameworkCss,
  isBaseColor,
  resolvedVariables,
  shadesOf
} from "./framework";
import { frameworkStylesheet, mainFramework } from "./main-framework";

const withShades = () => {
  const fw = mainFramework();
  return {
    ...fw,
    colorOptions: {
      ...fw.colorOptions,
      primary: {
        ...NO_COLOR_OPTIONS,
        light: true,
        dark: true,
        transparent: true,
        utility: ["background-color" as const, "border-color" as const]
      }
    }
  };
};

describe("color shades and utilities", () => {
  it("generates shades from the options", () => {
    const names = shadesOf("primary", {
      ...NO_COLOR_OPTIONS,
      light: true,
      dark: true,
      transparent: true,
      utility: []
    }).map((s) => s.name);
    expect(names).toContain("primary-l-1");
    expect(names).toContain("primary-d-3");
    expect(names).toContain("primary-t-20");
    expect(
      shadesOf("primary", {
        ...NO_COLOR_OPTIONS,
        light: false,
        dark: false,
        transparent: false,
        utility: []
      })
    ).toEqual([]);
  });

  it("derives variables only for colors that exist", () => {
    const fw = withShades();
    const derived = derivedColorVariables({
      variables: fw.variables,
      colorOptions: { ...fw.colorOptions, ghost: { ...NO_COLOR_OPTIONS, light: true } }
    });
    expect(derived.some((v) => v.name === "primary-l-1")).toBe(true);
    expect(derived.some((v) => v.name.startsWith("ghost"))).toBe(false);
  });

  it("writes derived variables to the theme output and utility classes to the stylesheet", () => {
    const fw = withShades();
    const css = frameworkVariablesCss(fw, "main", true);
    expect(css).toContain("--primary-d-1:color-mix(");
    const sheet = frameworkStylesheet(fw);
    expect(sheet).toContain(".bg-primary{background-color:var(--primary)}");
    expect(sheet).toContain(".border-primary-t-20{border-color:var(--primary-t-20)}");
    expect(sheet).not.toContain(".text-bg{");
  });

  it("lists a color but not a shade that has its base", () => {
    const vars = [
      { name: "primary", value: "#fff" },
      { name: "primary-d-1", value: "#eee" },
      { name: "gap", value: "1rem" }
    ];
    expect(isBaseColor(vars[0]!, vars)).toBe(true);
    expect(isBaseColor(vars[1]!, vars)).toBe(false);
    expect(isBaseColor(vars[2]!, vars)).toBe(false);
  });

  it("round trips options, groups and prefix through export and import", () => {
    const fw = { ...withShades(), colorPrefix: "brand-" };
    const out = importFrameworkCss(exportFrameworkCss(fw, frameworkStylesheet(fw)), "Main");
    if ("error" in out) throw new Error(out.error);
    expect(out.framework.colorPrefix).toBe("brand-");
    expect(out.framework.colorOptions.primary?.utility).toContain("background-color");
    expect(out.framework.variables.find((v) => v.name === "primary")?.group).toBe("Brand");
    // Shades are regenerated, not stored as plain variables.
    expect(out.framework.variables.some((v) => v.name === "primary-d-1")).toBe(false);
    expect(resolvedVariables(out.framework).some((v) => v.name === "primary-d-1")).toBe(true);
    // Generated utility classes are not duplicated into the imported stylesheet.
    expect(frameworkClasses(out.framework.css).some((c) => c.name === "bg-primary")).toBe(false);
    expect(colorUtilityCss(out.framework)).toContain(".bg-primary{");
  });
});

describe("shade counts and overrides", () => {
  it("generates the asked number of shades, in order, and keeps hand-set shades", () => {
    const names = shadesOf("a", {
      ...NO_COLOR_OPTIONS,
      light: true,
      lightCount: 10,
      dark: true,
      darkCount: 2
    }).map((s) => s.name);
    expect(names.filter((n) => n.startsWith("a-l-"))).toHaveLength(10);
    expect(names).toContain("a-l-10");
    expect(names.filter((n) => n.startsWith("a-d-"))).toHaveLength(2);
    const set = shadesOf("a", {
      ...NO_COLOR_OPTIONS,
      light: true,
      overrides: { "l-1": "#123456" }
    });
    expect(set[0]?.value).toBe("#123456");
    expect(set[1]?.value).toContain("color-mix(");
  });
});
