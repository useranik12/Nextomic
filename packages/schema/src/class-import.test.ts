import { describe, expect, it } from "vitest";
import { DEFAULT_BREAKPOINTS } from "./breakpoint";
import { exportClassesCss, importClassesCss } from "./class-import";
import type { StyleMap } from "./style";

const classes: Record<string, StyleMap> = {
  card: {
    breakpoints: {
      base: { default: { color: "red" }, hover: { color: "blue" } },
      tablet: { default: { padding: "8px" } }
    }
  },
  btn: { breakpoints: { base: { default: { margin: "0" } } } }
};

describe("class import and export", () => {
  it("round-trips classes through CSS", () => {
    const css = exportClassesCss(classes, DEFAULT_BREAKPOINTS);
    const result = importClassesCss(css, DEFAULT_BREAKPOINTS);
    expect(result).toEqual({ ok: true, classes, skipped: 0 });
  });

  it("counts rules it cannot model and rejects invalid CSS", () => {
    const result = importClassesCss(
      ".a{color:red} #id{color:blue} .a .b{x:1}",
      DEFAULT_BREAKPOINTS
    );
    expect(result.ok && result.classes.a?.breakpoints.base?.default).toEqual({ color: "red" });
    expect(result.ok && result.skipped).toBe(2);
    expect(importClassesCss(".a{", DEFAULT_BREAKPOINTS).ok).toBe(false);
  });
});
