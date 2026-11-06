import { describe, expect, it } from "vitest";
import { DEFAULT_BREAKPOINTS, parseStyleCss, styleMapToCss, type StyleMap } from "./index";

const SEL = ".card";
const tablet = DEFAULT_BREAKPOINTS.find((b) => b.kind === "down")?.id ?? "tablet";

const sample = (): StyleMap => ({
  breakpoints: {
    base: {
      default: { display: "flex", gap: "16px", "--accent": "#06f" },
      hover: { color: "red" }
    },
    [tablet]: { default: { gap: "8px" } }
  }
});

function parsed(css: string) {
  const result = parseStyleCss(css, SEL, DEFAULT_BREAKPOINTS);
  if (!result.ok) throw new Error(result.error);
  return result.styles;
}

describe("css text round trip", () => {
  it("visual edit -> CSS -> parse gives the same StyleMap", () => {
    const css = styleMapToCss(sample(), SEL, DEFAULT_BREAKPOINTS);
    expect(css).toContain("@media (max-width: 768px)");
    expect(parsed(css)).toEqual(sample());
  });

  it("CSS edit -> StyleMap -> CSS is stable", () => {
    const css =
      ".card {\n  color:red ;  margin:0 auto}\n@media (max-width:768px){.card:hover{opacity:.5}}";
    const once = styleMapToCss(parsed(css), SEL, DEFAULT_BREAKPOINTS);
    expect(styleMapToCss(parsed(once), SEL, DEFAULT_BREAKPOINTS)).toBe(once);
    expect(parsed(css).breakpoints[tablet]?.hover).toEqual({ opacity: ".5" });
  });

  it("keeps what it cannot model in raw and prints it again", () => {
    const css =
      ".card { color: red }\n.card .child { margin: 0 }\n@keyframes spin { to { opacity: 0 } }\n/* note */\n.card { -webkit-line-clamp: 2 }";
    const styles = parsed(css);
    expect(styles.breakpoints.base?.default).toEqual({ color: "red" });
    expect(styles.raw).toContain(".card .child");
    expect(styles.raw).toContain("@keyframes spin");
    expect(styles.raw).toContain("/* note */");
    expect(styles.raw).toContain("-webkit-line-clamp");
    const again = parsed(styleMapToCss(styles, SEL, DEFAULT_BREAKPOINTS));
    expect(again).toEqual(styles);
  });

  it("keeps important flags and bare declarations", () => {
    const styles = parsed("color: red !important; gap: 4px");
    expect(styles.breakpoints.base?.default).toEqual({ color: "red !important", gap: "4px" });
  });

  it("reports invalid CSS and does not return a map", () => {
    const result = parseStyleCss(".card { color: red", SEL, DEFAULT_BREAKPOINTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.line).toBe(1);
  });

  it("keeps unknown media queries raw", () => {
    const styles = parsed("@media (max-width: 500px) { .card { gap: 1px } }");
    expect(styles.breakpoints).toEqual({});
    expect(styles.raw).toContain("(max-width: 500px)");
  });
});
