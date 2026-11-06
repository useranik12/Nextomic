import { describe, expect, it } from "vitest";
import {
  detectColorFormat,
  formatColor,
  hslToRgb,
  hsvToRgb,
  parseColor,
  rgbToHsl,
  rgbToHsv,
  toHex,
  toHslString,
  toRgbString
} from "./color";

describe("parseColor", () => {
  it("reads hex in every length", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#0066ff")).toEqual({ r: 0, g: 102, b: 255, a: 1 });
    expect(parseColor("#0066ff80")?.a).toBeCloseTo(0.502, 2);
    expect(parseColor("#f008")).toEqual({ r: 255, g: 0, b: 0, a: 0.533 });
  });

  it("reads rgb and hsl in comma and space syntax", () => {
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseColor("rgba(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor("hsla(120 100% 25% / 0.4)")).toEqual({ r: 0, g: 128, b: 0, a: 0.4 });
  });

  it("reads names and rejects other text", () => {
    expect(parseColor("White")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("transparent")?.a).toBe(0);
    expect(parseColor("var(--primary)")).toBeNull();
    expect(parseColor("#12")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("conversions", () => {
  it("round trips rgb through hsl and hsv", () => {
    const c = { r: 12, g: 150, b: 220, a: 1 };
    const viaHsl = hslToRgb(rgbToHsl(c));
    expect(Math.abs(viaHsl.r - c.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(viaHsl.g - c.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(viaHsl.b - c.b)).toBeLessThanOrEqual(1);
    const viaHsv = hsvToRgb(rgbToHsv(c));
    expect(Math.abs(viaHsv.g - c.g)).toBeLessThanOrEqual(1);
  });

  it("formats each mode and keeps alpha", () => {
    const c = { r: 0, g: 102, b: 255, a: 0.5 };
    expect(toHex(c)).toBe("#0066ff80");
    expect(toRgbString(c)).toBe("rgba(0, 102, 255, 0.5)");
    expect(toHslString({ ...c, a: 1 })).toBe("hsl(216, 100%, 50%)");
    expect(toHex({ ...c, a: 1 })).toBe("#0066ff");
    expect(formatColor(c, "css", "color-mix(in srgb, red, blue)")).toBe(
      "color-mix(in srgb, red, blue)"
    );
  });

  it("detects the mode of a value", () => {
    expect(detectColorFormat("#fff")).toBe("hex");
    expect(detectColorFormat("RGBA(0,0,0,.5)")).toBe("rgb");
    expect(detectColorFormat("hsl(1 2% 3%)")).toBe("hsl");
    expect(detectColorFormat("var(--x)")).toBe("css");
  });
});
