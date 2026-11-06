import { describe, expect, it } from "vitest";
import { NO_COLOR_OPTIONS } from "./framework-colors";
import {
  addColor,
  addColorGroup,
  applyColorPrefix,
  colorGroups,
  frameworkColors,
  removeColorGroup,
  renameColor,
  renameColorGroup,
  setColorOptions,
  setColorValue,
  type ColorResult
} from "./framework-color-ops";
import { mainFramework } from "./main-framework";

const ok = (r: ColorResult) => {
  if ("error" in r) throw new Error(r.error);
  return r.framework;
};

describe("color operations", () => {
  it("lists colors by palette", () => {
    const fw = mainFramework();
    expect(colorGroups(fw)).toEqual(["Brand", "Status", "Surface"]);
    expect(frameworkColors(fw).some((c) => c.name === "primary-d-1")).toBe(false);
    expect(frameworkColors(fw).find((c) => c.name === "primary")?.options).toEqual(
      NO_COLOR_OPTIONS
    );
  });

  it("adds, validates and renames a color with its options", () => {
    let fw = ok(
      addColor(mainFramework(), { name: "brand-pink", value: "#ff00aa", group: "Brand" })
    );
    expect(frameworkColors(fw).some((c) => c.name === "brand-pink")).toBe(true);
    expect("error" in addColor(fw, { name: "brand-pink", value: "#fff", group: "Brand" })).toBe(
      true
    );
    expect("error" in addColor(fw, { name: "9bad", value: "#fff", group: "Brand" })).toBe(true);
    expect("error" in addColor(fw, { name: "nice", value: "not a color", group: "Brand" })).toBe(
      true
    );
    fw = ok(
      setColorOptions(fw, "brand-pink", {
        ...NO_COLOR_OPTIONS,
        light: true,
        dark: false,
        transparent: false,
        utility: ["color"]
      })
    );
    fw = ok(renameColor(fw, "brand-pink", "brand-rose"));
    expect(fw.colorOptions["brand-rose"]?.light).toBe(true);
    expect(fw.colorOptions["brand-pink"]).toBeUndefined();
  });

  it("sets and clears the dark value", () => {
    let fw = ok(setColorValue(mainFramework(), "primary", "dark", null));
    expect(fw.variables.find((v) => v.name === "primary")?.dark).toBeUndefined();
    fw = ok(setColorValue(fw, "primary", "dark", "#123456"));
    expect(fw.variables.find((v) => v.name === "primary")?.dark).toBe("#123456");
  });

  it("manages palettes", () => {
    let fw = ok(addColorGroup(mainFramework(), "Seasonal"));
    expect(colorGroups(fw)).toContain("Seasonal");
    expect("error" in addColorGroup(fw, "brand")).toBe(true);
    fw = ok(renameColorGroup(fw, "Brand", "Core"));
    expect(frameworkColors(fw).find((c) => c.name === "primary")?.group).toBe("Core");
    fw = removeColorGroup(fw, "Core");
    expect(frameworkColors(fw).some((c) => c.name === "primary")).toBe(false);
    expect(fw.colorOptions.primary).toBeUndefined();
  });
});

describe("color prefix", () => {
  it("renames every color, its shades and the references to them", () => {
    const base = mainFramework();
    const fw = {
      ...base,
      colorOptions: { ...base.colorOptions, primary: { ...NO_COLOR_OPTIONS, light: true } },
      variables: [...base.variables, { name: "hero", value: "var(--primary)" }]
    };
    const out = applyColorPrefix(fw, "brand-");
    if ("error" in out) throw new Error(out.error);
    expect(out.framework.colorPrefix).toBe("brand-");
    expect(out.framework.variables.some((v) => v.name === "brand-primary")).toBe(true);
    expect(out.framework.variables.some((v) => v.name === "primary")).toBe(false);
    expect(out.framework.variables.find((v) => v.name === "hero")?.value).toBe(
      "var(--brand-primary)"
    );
    expect(out.renames).toContainEqual(["primary", "brand-primary"]);
    expect(out.renames).toContainEqual(["primary-l-1", "brand-primary-l-1"]);
    expect(out.framework.colorOptions["brand-primary"]?.light).toBe(true);
    const back = applyColorPrefix(out.framework, "");
    if ("error" in back) throw new Error(back.error);
    expect(back.framework.variables.some((v) => v.name === "primary")).toBe(true);
  });

  it("refuses a prefix that makes two names equal or clashes with another variable", () => {
    const fw = {
      ...mainFramework(),
      variables: [...mainFramework().variables, { name: "x-primary", value: "1px" }]
    };
    expect("error" in applyColorPrefix(fw, "x-")).toBe(true);
    expect("error" in applyColorPrefix(fw, "9")).toBe(true);
  });
});
