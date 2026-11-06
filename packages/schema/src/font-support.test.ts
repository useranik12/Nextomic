import { describe, expect, it } from "vitest";
import { fontSupportFor, primaryFamily } from "./font-support";
import { fontSchema } from "./fonts";

const file = (over: Record<string, unknown>) => ({
  file: "a.woff2",
  format: "woff2",
  weight: 400,
  style: "normal",
  subset: "latin",
  bytes: 1000,
  sha256: "a".repeat(64),
  ...over
});
const font = (family: string, files: Record<string, unknown>[], extra = {}) =>
  fontSchema.parse({
    id: family.toLowerCase(),
    family,
    source: "upload",
    category: "sans-serif",
    active: true,
    rights: true,
    files: files.map(file),
    ...extra
  });

describe("primaryFamily", () => {
  it("reads the first family", () => {
    expect(primaryFamily('"Inter", sans-serif')).toBe("Inter");
    expect(primaryFamily("'Open Sans', Arial")).toBe("Open Sans");
    expect(primaryFamily("var(--nxt-font-body)")).toBeNull();
    expect(primaryFamily(undefined)).toBeNull();
  });
});

describe("fontSupportFor", () => {
  const fonts = [
    font("Inter", [{ weight: 400 }, { weight: 700 }, { weight: 400, style: "italic" }]),
    font("Var", [{ weight: 300, weightMax: 800 }]),
    font("Off", [{ weight: 400 }], { active: false })
  ];

  it("lists the installed weights and italic support", () => {
    expect(fontSupportFor(fonts, '"Inter", sans-serif')).toEqual({
      family: "Inter",
      weights: [400, 700],
      italic: true
    });
  });

  it("steps through a variable range and reports no italic", () => {
    expect(fontSupportFor(fonts, "Var")).toEqual({
      family: "Var",
      weights: [300, 400, 500, 600, 700, 800],
      italic: false
    });
  });

  it("returns null for system, unknown and unused fonts", () => {
    expect(fontSupportFor(fonts, "system-ui")).toBeNull();
    expect(fontSupportFor(fonts, "Off")).toBeNull();
    expect(fontSupportFor(fonts, undefined)).toBeNull();
  });
});
