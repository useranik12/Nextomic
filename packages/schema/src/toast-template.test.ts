import { describe, expect, it } from "vitest";
import { pageTreeSchema } from "./loop-names";
import { defaultToastTree } from "./toast-template";
import { runExpression } from "./expression/evaluate";
import { dynamicTextOf } from "./value";

describe("toast template", () => {
  it("starts from a valid tree that reads toast values", () => {
    const tree = defaultToastTree();
    expect(pageTreeSchema.safeParse(tree).success).toBe(true);
    // Text props hold tags as mixed text, the form the renderer resolves.
    const texts = tree.children[0]?.children[1]?.children.map((n) => n.props.text);
    expect(texts?.map((t) => dynamicTextOf(t))).toEqual([
      "{{ toast.title }}",
      "{{ toast.message }}"
    ]);
    expect(texts?.every((t) => typeof t === "object" && t !== null)).toBe(true);
  });

  it("colors the dot by type", () => {
    const dot = defaultToastTree().children[0]?.children[0];
    const color = dot?.styles.breakpoints.base?.default?.["background-color"] ?? "";
    const expr = color.slice(2, -2);
    expect(runExpression(expr, { toast: { type: "danger" } })).toBe("#f31260");
    expect(runExpression(expr, { toast: { type: "" } })).toBe("#006fee");
  });
});
