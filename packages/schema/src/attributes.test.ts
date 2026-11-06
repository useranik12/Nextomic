import { describe, expect, it } from "vitest";
import { isAllowedAttribute } from "./attributes";

describe("isAllowedAttribute", () => {
  it("allows aria, data and common HTML attributes", () => {
    for (const name of ["aria-label", "data-track", "title", "href", "alt", "tabindex"]) {
      expect(isAllowedAttribute(name)).toBe(true);
    }
  });
  it("blocks handlers, style, id, class and unknown names", () => {
    for (const name of [
      "onclick",
      "onerror",
      "style",
      "id",
      "class",
      "srcdoc",
      "data-nid",
      "Bad",
      "x y",
      "foo"
    ]) {
      expect(isAllowedAttribute(name)).toBe(false);
    }
  });
});
