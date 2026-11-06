import { describe, expect, it } from "vitest";
import { tokenizeCss } from "./css-highlight";

const kinds = (css: string) =>
  tokenizeCss(css)
    .filter((t) => t.type !== "text" && t.type !== "punct")
    .map((t) => `${t.type}:${t.text}`);

describe("tokenizeCss", () => {
  it("colors selectors, properties and values", () => {
    expect(kinds(".card:hover { color: #fff; gap: 1.5rem; }")).toEqual([
      "class:.card",
      "pseudo::hover",
      "property:color",
      "color:#fff",
      "property:gap",
      "number:1.5rem"
    ]);
  });

  it("handles at-rules with nested rules, functions, strings and comments", () => {
    const k = kinds(
      '@media (max-width: 768px) {\n  #a { background: url("x.png") !important } /* c */\n}'
    );
    expect(k).toContain("at:@media");
    expect(k).toContain("number:768px");
    expect(k).toContain("id:#a");
    expect(k).toContain("function:url");
    expect(k).toContain('string:"x.png"');
    expect(k).toContain("important:!important");
    expect(k).toContain("comment:/* c */");
  });

  it("keeps every character and tolerates unfinished CSS", () => {
    for (const css of [".a { color: red", "@media", "/* open", 'a { b: "x', "}}{"]) {
      expect(
        tokenizeCss(css)
          .map((t) => t.text)
          .join("")
      ).toBe(css);
    }
  });
});
