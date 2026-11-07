import { describe, expect, it } from "vitest";
import { formatCode } from "./format-code";

describe("formatCode", () => {
  it("formats CSS, JavaScript and JSON", async () => {
    expect((await formatCode(".a{color:red;margin:0}", "css")).code).toBe(
      ".a {\n  color: red;\n  margin: 0;\n}"
    );
    expect((await formatCode("gsap.to('.a',{x:1})", "js")).code).toBe('gsap.to(".a", { x: 1 });');
    expect((await formatCode('{"x":1}', "json")).code).toBe('{\n  "x": 1\n}');
    expect((await formatCode("{bad", "json")).ok).toBe(false);
  });

  it("leaves broken code as it is and says why", async () => {
    const result = await formatCode(".a{color:", "css");
    expect(result.ok).toBe(false);
    expect(result.code).toBe(".a{color:");
    expect(result.error).toBeTruthy();
  });
});
