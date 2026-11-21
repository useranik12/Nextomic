import { describe, expect, it } from "vitest";
import { flipInverted, invertedRef, isInverted, modeValues, plainRef } from "./color-invert";
import { NO_COLOR_OPTIONS, derivedColorVariables, shadesOf } from "./framework-colors";
import { frameworkVariablesCss, type Framework } from "./framework";
import { mainFramework } from "./main-framework";

const framework = (options = {}): Framework => ({
  ...mainFramework({ colors: false }),
  variables: [
    { name: "primary", value: "#4f46e5", dark: "#a5b4fc" },
    { name: "plain", value: "#111111" }
  ],
  colorOptions: {
    primary: { ...NO_COLOR_OPTIONS, light: true, dark: true, ...options }
  }
});

describe("shade dark mode versions", () => {
  it("have none until the group asks for them", () => {
    const shades = shadesOf("primary", framework().colorOptions.primary!);
    expect(shades.every((s) => s.dark === undefined)).toBe(true);
  });

  it("mirror the mix: light shades mix with black and dark shades with white in dark mode", () => {
    const o = framework({ lightDarkMode: true, darkDarkMode: true }).colorOptions.primary!;
    const l1 = shadesOf("primary", o).find((s) => s.suffix === "l-1")!;
    const d1 = shadesOf("primary", o).find((s) => s.suffix === "d-1")!;
    expect(l1.value).toBe("color-mix(in srgb, var(--primary) 85%, white)");
    expect(l1.dark).toBe("color-mix(in srgb, var(--primary) 85%, black)");
    expect(d1.value).toBe("color-mix(in srgb, var(--primary) 85%, black)");
    expect(d1.dark).toBe("color-mix(in srgb, var(--primary) 85%, white)");
  });

  it("use a hand set dark value over the mirror mix, and only when the group has dark mode on", () => {
    const on = framework({ lightDarkMode: true, darkOverrides: { "l-1": "#123456" } });
    expect(
      shadesOf("primary", on.colorOptions.primary!).find((s) => s.suffix === "l-1")!.dark
    ).toBe("#123456");
    const off = framework({ darkOverrides: { "l-1": "#123456" } });
    expect(
      shadesOf("primary", off.colorOptions.primary!).find((s) => s.suffix === "l-1")!.dark
    ).toBeUndefined();
  });

  it("go to the dark rule of the stylesheet as variables, with color-scheme for light-dark()", () => {
    const fw = framework({ lightDarkMode: true });
    expect(derivedColorVariables(fw).find((v) => v.name === "primary-l-1")?.dark).toBeDefined();
    const css = frameworkVariablesCss(fw, "main", true);
    const [light, dark] = css.split('[data-nxt-mode="dark"]');
    expect(light).toContain("color-scheme:light");
    expect(dark).toContain("--primary-l-1:color-mix(in srgb, var(--primary) 85%, black)");
    expect(dark).toContain("color-scheme:dark");
    expect(frameworkVariablesCss(fw, "main", false)).not.toContain("color-scheme");
  });
});

describe("inverse colors", () => {
  it("wrap and unwrap a reference", () => {
    expect(invertedRef("var(--primary)")).toBe("nxt-inv(var(--primary))");
    expect(isInverted("nxt-inv(var(--primary))")).toBe(true);
    expect(isInverted("var(--primary)")).toBe(false);
    expect(plainRef("nxt-inv(var(--primary))")).toBe("var(--primary)");
    expect(plainRef("#fff")).toBe("#fff");
  });

  it("flip a color with a dark value to light-dark(dark, light), nothing stored in the framework", () => {
    const fw = framework();
    expect(flipInverted("a{color:nxt-inv(var(--primary))}", fw)).toBe(
      "a{color:light-dark(#a5b4fc,#4f46e5)}"
    );
  });

  it("flip a shade with the values it has in each mode", () => {
    const fw = framework({ lightDarkMode: true });
    expect(modeValues(fw, "primary-l-1")).toEqual({
      light: "color-mix(in srgb, #4f46e5 85%, white)",
      dark: "color-mix(in srgb, #a5b4fc 85%, black)"
    });
    const plainShade = framework();
    expect(modeValues(plainShade, "primary-l-1")?.dark).toBe(
      "color-mix(in srgb, #a5b4fc 85%, white)"
    );
  });

  it("fall back to the plain variable when there is nothing to invert", () => {
    const fw = framework();
    expect(flipInverted("a{color:nxt-inv(var(--plain))}", fw)).toBe("a{color:var(--plain)}");
    expect(flipInverted("a{color:nxt-inv(var(--gone))}", fw)).toBe("a{color:var(--gone)}");
    expect(flipInverted("a{color:nxt-inv(var(--primary))}", null)).toBe("a{color:var(--primary)}");
    expect(flipInverted("a{color:red}", fw)).toBe("a{color:red}");
  });
});
