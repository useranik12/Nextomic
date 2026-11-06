import { describe, expect, it } from "vitest";
import { parseColor } from "./color";
import { darkVariant, mixedColorText, oklchToRgb, rgbToOklch } from "./color-math";

const lightness = (hex: string): number =>
  rgbToOklch(parseColor(hex) as NonNullable<ReturnType<typeof parseColor>>).l;

describe("OKLCH", () => {
  it("round trips colors inside the gamut", () => {
    for (const hex of ["#4f46e5", "#16a34a", "#f59e0b", "#808080", "#ffffff", "#000000"]) {
      const rgb = parseColor(hex);
      if (!rgb) throw new Error(hex);
      const back = oklchToRgb(rgbToOklch(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it("maps out of gamut colors into sRGB without throwing", () => {
    const rgb = oklchToRgb({ l: 0.7, c: 0.5, h: 150 });
    expect([rgb.r, rgb.g, rgb.b].every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});

describe("dark variant", () => {
  it("is always darker than the color it comes from", () => {
    for (const hex of [
      "#ffffff",
      "#f8fafc",
      "#4f46e5",
      "#06b6d4",
      "#f59e0b",
      "#475569",
      "#0f172a",
      "#000000"
    ]) {
      const dark = darkVariant(hex);
      expect(dark).not.toBeNull();
      expect(lightness(dark as string)).toBeLessThanOrEqual(lightness(hex));
    }
  });

  it("keeps the hue of a colored value and the format it was written in", () => {
    expect(darkVariant("#4f46e5")).toMatch(/^#[0-9a-f]{6}$/);
    expect(darkVariant("rgb(79, 70, 229)")).toMatch(/^rgba?\(/);
    expect(darkVariant("hsl(243, 75%, 59%)")).toMatch(/^hsla?\(/);
    const a = rgbToOklch(parseColor("#4f46e5") as NonNullable<ReturnType<typeof parseColor>>).h;
    const b = rgbToOklch(
      parseColor(darkVariant("#4f46e5") as string) as NonNullable<ReturnType<typeof parseColor>>
    ).h;
    expect(Math.abs(a - b)).toBeLessThan(6);
  });

  it("keeps alpha and refuses non colors", () => {
    expect(darkVariant("#4f46e580")).toMatch(/^#[0-9a-f]{8}$/);
    expect(darkVariant("var(--x)")).toBeNull();
  });
});

describe("mixed shades", () => {
  it("mixes with white, black and transparent in the format of the base", () => {
    expect(mixedColorText("#000000", 50, "white")?.text).toBe("#808080");
    expect(mixedColorText("#ffffff", 50, "black")?.text).toBe("#808080");
    expect(mixedColorText("#ff0000", 50, "transparent")?.text).toBe("#ff000080");
    expect(mixedColorText("rgb(255, 0, 0)", 50, "transparent")?.text).toMatch(/^rgba\(/);
    expect(mixedColorText("var(--x)", 50, "white")).toBeNull();
  });
});
