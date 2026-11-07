import { describe, expect, it } from "vitest";
import {
  DEFAULT_BREAKPOINTS,
  dynamicTextOf,
  parseDynamicText,
  sortBreakpoints,
  type BreakpointDef
} from "./index";

describe("sortBreakpoints", () => {
  it("orders up (widest first), base, then down (widest first)", () => {
    const wide: BreakpointDef = {
      id: "wide",
      name: "Wide",
      icon: "desktop",
      kind: "up",
      width: 1920
    };
    const small: BreakpointDef = {
      id: "small",
      name: "Small",
      icon: "mobile",
      kind: "down",
      width: 320
    };
    const shuffled = [small, ...DEFAULT_BREAKPOINTS.slice().reverse(), wide];
    expect(sortBreakpoints(shuffled).map((b) => b.id)).toEqual([
      "wide",
      "base",
      "tablet",
      "mobile",
      "small"
    ]);
  });
});

describe("dynamic text", () => {
  it("keeps plain text as a string", () => {
    expect(parseDynamicText("Hello")).toBe("Hello");
  });

  it("round-trips tokens between text", () => {
    const value = parseDynamicText("Hi {{param.name}}, you have {{state.count}} items");
    expect(value).toEqual({
      kind: "mixed",
      parts: ["Hi ", { token: "param.name" }, ", you have ", { token: "state.count" }, " items"]
    });
    expect(dynamicTextOf(value)).toBe("Hi {{param.name}}, you have {{state.count}} items");
  });

  it("keeps the spaces written inside the braces", () => {
    expect(dynamicTextOf(parseDynamicText("A {{ app.x.toUpperCase() }}"))).toBe(
      "A {{ app.x.toUpperCase() }}"
    );
  });
});
