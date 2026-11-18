import { DEFAULT_BREAKPOINTS } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { classCss } from "./css";

describe("raw CSS output", () => {
  it("emits raw CSS after the structured rules", () => {
    const css = classCss(
      "card",
      { breakpoints: { base: { default: { color: "red" } } }, raw: ".card .child{margin:0}" },
      DEFAULT_BREAKPOINTS
    );
    expect(css).toBe(".card{color:red}.card .child{margin:0}");
  });

  it("drops raw CSS that could close the style tag", () => {
    const css = classCss(
      "card",
      { breakpoints: {}, raw: "</style><script>x</script>" },
      DEFAULT_BREAKPOINTS
    );
    expect(css).toBe("");
  });
});

describe("container defaults", () => {
  it("BASE_CSS makes container tags a flex column with zero specificity", async () => {
    const { BASE_CSS } = await import("./css");
    expect(BASE_CSS).toContain(
      ":where([data-nid]:is(div,section,header,main,nav,aside,article,footer)){display:flex;flex-direction:column}"
    );
  });

  it("builtinStyle reports the default only for containers", async () => {
    await import("./elements");
    const { builtinStyle } = await import("./css");
    expect(builtinStyle({ type: "container", htmlTag: "div" }, "display")).toBe("flex");
    expect(builtinStyle({ type: "section", htmlTag: undefined }, "flex-direction")).toBe("column");
    expect(builtinStyle({ type: "container", htmlTag: "div" }, "gap")).toBeUndefined();
    expect(builtinStyle({ type: "heading", htmlTag: "h1" }, "display")).toBeUndefined();
  });
  it("BASE_CSS removes browser margins from text tags with zero specificity", async () => {
    const { BASE_CSS } = await import("./css");
    expect(BASE_CSS).toContain(
      ":where(h1,h2,h3,h4,h5,h6,p,blockquote,figure,pre,ul,ol,dl,dd){margin:0}"
    );
  });
});

describe("Form Input part styles", () => {
  const tablet = DEFAULT_BREAKPOINTS.find((b) => b.kind === "down")?.id ?? "tablet";
  const css = (decls: Record<string, string>, breakpoint = "base") =>
    classCss("f", { breakpoints: { [breakpoint]: { default: decls } } }, DEFAULT_BREAKPOINTS);

  it("keeps a custom property setting (the slider thumb size) in the page CSS", () => {
    const out = css({ "--nxt-ip-slider---nxt-thumb": "28px" });
    expect(out).toContain("[data-nxt-range]");
    expect(out).toContain("--nxt-thumb:28px");
  });

  it("writes a part setting as a plain declaration on the part, never as a variable", () => {
    const out = css({ "--nxt-ip-box-border-color": "#f00" });
    expect(out).toBe(
      ".f[data-nxt-field] [data-nxt-box],.f [data-nxt-field] [data-nxt-box]{border-color:#f00}"
    );
    expect(out).not.toContain("--nxt-ip");
    expect(out).not.toContain("var(");
  });

  it("emits nothing at a breakpoint where nothing is set, so the default look stays", () => {
    const out = css({ "--nxt-ip-box-padding": "4px" }, tablet);
    expect(out.startsWith("@media")).toBe(true);
    expect(out.replace(/@media[^{]+\{/, "")).toContain("padding:4px");
    // Nothing outside the media query: desktop has no rule for the box at all.
    expect(out.indexOf("[data-nxt-box]")).toBeGreaterThan(out.indexOf("@media"));
    expect(css({ color: "red" })).toBe(".f{color:red}");
  });

  it("styles a state only in that state, with a forced form for the canvas", () => {
    const out = css({ "--nxt-ip-box-border-color-error": "#a00" });
    expect(out).toContain(".f[data-nxt-field][data-invalid] [data-nxt-box]");
    expect(out).toContain('[data-nxt-force="error"]');
    expect(out).not.toContain(".f [data-nxt-field] [data-nxt-box]{");
  });

  it("orders states so an error beats a focus and disabled comes last", () => {
    const out = css({
      "--nxt-ip-box-border-color-disabled": "#111",
      "--nxt-ip-box-border-color-error": "#222",
      "--nxt-ip-box-border-color-focus": "#333",
      "--nxt-ip-box-border-color": "#444"
    });
    const at = (color: string) => out.indexOf(`border-color:${color}`);
    expect(at("#444")).toBeLessThan(at("#333"));
    expect(at("#333")).toBeLessThan(at("#222"));
    expect(at("#222")).toBeLessThan(at("#111"));
  });

  it("keeps hidden messages hidden by scoping their rules to shown ones", () => {
    const out = css({ "--nxt-ip-error-padding": "8px", "--nxt-ip-clear-width": "20px" });
    expect(out).toContain("[data-nxt-error]:not([hidden])");
    expect(out).toContain("[data-nxt-clear]:not([hidden])");
  });

  it("drops settings the table does not list, unsafe values and states a part lacks", () => {
    expect(css({ "--nxt-ip-box-position": "fixed" })).toBe("");
    expect(css({ "--nxt-ip-nope-color": "red" })).toBe("");
    expect(css({ "--nxt-ip-error-color-focus": "red" })).toBe("");
    expect(css({ "--nxt-ip-box-padding": "1px;}body{x:y" })).toBe("");
  });

  it("the default look is zero specificity and shipped with every page that has an input", async () => {
    const { INPUT_BASE_CSS } = await import("./input-css");
    for (const rule of INPUT_BASE_CSS.split("}").filter((r) => r.startsWith(":where("))) {
      expect(rule.startsWith(":where(")).toBe(true);
    }
    expect(INPUT_BASE_CSS).toContain("border:1px solid");
    expect(INPUT_BASE_CSS).toContain("[hidden]{display:none}");
  });
});

describe("Form Options part styles", () => {
  const css = (decls: Record<string, string>) =>
    classCss("f", { breakpoints: { base: { default: decls } } }, DEFAULT_BREAKPOINTS);

  it("writes option parts on every option of the field", () => {
    expect(css({ "--nxt-ip-mark-border-radius": "50%" })).toBe(
      ".f[data-nxt-field] [data-nxt-choice] [data-nxt-mark],.f [data-nxt-field] [data-nxt-choice] [data-nxt-mark]{border-radius:50%}"
    );
  });

  it("styles the chosen state and orders it before error and disabled", () => {
    const out = css({
      "--nxt-ip-mark-background-color-disabled": "#111",
      "--nxt-ip-mark-background-color-checked": "#222"
    });
    expect(out).toContain(":has(:where([data-nxt-control]:checked))");
    expect(out.indexOf("#222")).toBeLessThan(out.indexOf("#111"));
  });
});
