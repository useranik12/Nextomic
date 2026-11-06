import { describe, expect, it } from "vitest";
import { countClassUsage, emptyPageTree, replaceClassInTree, type ElementNode } from "./index";

const n = (id: string, classIds: string[], children: ElementNode[] = []): ElementNode => ({
  id,
  type: "container",
  classIds,
  props: {},
  styles: { breakpoints: {} },
  actions: {},
  children
});

function sample(): ElementNode {
  const root = emptyPageTree();
  root.children = [n("a", ["card", "big"], [n("b", ["card"])]), n("c", ["big", "card"])];
  return root;
}

describe("class usage", () => {
  it("counts elements per class", () => {
    expect(countClassUsage(sample())).toEqual({ card: 3, big: 2 });
  });

  it("renames a class on every element and avoids duplicates", () => {
    const root = sample();
    expect(replaceClassInTree(root, "card", "tile")).toBe(true);
    expect(countClassUsage(root)).toEqual({ tile: 3, big: 2 });
    expect(replaceClassInTree(root, "big", "tile")).toBe(true);
    expect(root.children[1]?.classIds).toEqual(["tile"]);
  });

  it("removes a class and reports no change when unused", () => {
    const root = sample();
    expect(replaceClassInTree(root, "big", null)).toBe(true);
    expect(countClassUsage(root)).toEqual({ card: 3 });
    expect(replaceClassInTree(root, "missing", null)).toBe(false);
  });
});
