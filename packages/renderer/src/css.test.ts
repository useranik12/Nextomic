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
