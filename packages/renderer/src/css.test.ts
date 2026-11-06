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
});
