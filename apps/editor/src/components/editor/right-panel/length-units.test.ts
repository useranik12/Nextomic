import { describe, expect, it } from "vitest";
import { isNumberText, lengthMode, parseLength, unitSpecFor } from "./length-units";

const width = unitSpecFor("width")!;
const lineHeight = unitSpecFor("line-height")!;

describe("unitSpecFor", () => {
  it("knows numeric properties and skips the rest", () => {
    expect(unitSpecFor("width")?.keywords).toContain("auto");
    expect(unitSpecFor("max-width")?.keywords).toContain("none");
    expect(unitSpecFor("opacity")).toMatchObject({ units: [], unitless: true });
    expect(unitSpecFor("color")).toBeNull();
    expect(unitSpecFor("display")).toBeNull();
  });
  it("allows negative numbers only where CSS does", () => {
    expect(unitSpecFor("margin-top")?.negative).toBe(true);
    expect(unitSpecFor("width")?.negative).toBe(false);
    expect(unitSpecFor("padding")?.negative).toBe(false);
  });
});

describe("lengthMode", () => {
  it("splits numbers and units", () => {
    expect(lengthMode("12px", width)).toEqual({ mode: "number", amount: "12", unit: "px" });
    expect(lengthMode("1.5rem", width)).toEqual({ mode: "number", amount: "1.5", unit: "rem" });
    expect(lengthMode("0", width)).toEqual({ mode: "number", amount: "0", unit: "" });
  });
  it("detects keywords, empty and custom text", () => {
    expect(lengthMode("auto", width).mode).toBe("keyword");
    expect(lengthMode("", width).mode).toBe("empty");
    expect(lengthMode("calc(100% - 2rem)", width).mode).toBe("custom");
    expect(lengthMode("min(1440px, 92%)", width).mode).toBe("custom");
    expect(lengthMode("var(--nxt-space)", width).mode).toBe("custom");
    expect(lengthMode("12furlongs", width).mode).toBe("custom");
  });
  it("accepts a bare number only where it is valid", () => {
    expect(lengthMode("1.5", lineHeight)).toEqual({ mode: "number", amount: "1.5", unit: "" });
    expect(lengthMode("7", width).mode).toBe("custom");
  });
});

describe("number text", () => {
  it("rejects letters and, where not allowed, a minus sign", () => {
    expect(isNumberText("12.5", width)).toBe(true);
    expect(isNumberText("", width)).toBe(true);
    expect(isNumberText("1a", width)).toBe(false);
    expect(isNumberText("-4", width)).toBe(false);
    expect(isNumberText("-4", unitSpecFor("margin")!)).toBe(true);
  });
  it("parses plain lengths", () => {
    expect(parseLength("2em")).toEqual({ amount: "2", unit: "em" });
    expect(parseLength("auto")).toBeNull();
  });
});
