import { describe, expect, it } from "vitest";
import {
  anyStylesAt,
  assignMissingHtmlIds,
  duplicateNode,
  emptyPageTree,
  findNode,
  getStyle,
  indentNode,
  insertNode,
  isElementNameTaken,
  moveNode,
  outdentNode,
  shiftNode,
  unwrapNode,
  wrapNode,
  reassignBreakpointStyles,
  removeNode,
  setStyle,
  walkElements,
  type ElementNode
} from "./index";

const canHaveChildren = (type: string) => type !== "heading";

function n(id: string, type: string, children: ElementNode[] = []): ElementNode {
  return { id, type, classIds: [], props: {}, styles: { breakpoints: {} }, actions: {}, children };
}

function sample(): ElementNode {
  const root = emptyPageTree();
  root.id = "root";
  root.children = [
    n("a", "section", [n("a1", "heading"), n("a2", "container", [n("a2x", "heading")])]),
    n("b", "section")
  ];
  return root;
}

const ids = (node: ElementNode) => node.children.map((c) => c.id);

describe("tree operations", () => {
  it("finds nodes with parent and index", () => {
    const loc = findNode(sample(), "a2x");
    expect(loc?.parent?.id).toBe("a2");
    expect(findNode(sample(), "zzz")).toBeNull();
  });

  it("inserts at an index and refuses leaf parents", () => {
    const root = sample();
    expect(insertNode(root, "b", n("new", "text"), undefined, canHaveChildren)).toBe(true);
    expect(insertNode(root, "a", n("first", "text"), 0, canHaveChildren)).toBe(true);
    expect(ids(findNode(root, "a")!.node)[0]).toBe("first");
    expect(insertNode(root, "a1", n("bad", "text"), 0, canHaveChildren)).toBe(false);
  });

  it("removes a node but never the root", () => {
    const root = sample();
    expect(removeNode(root, "a2")?.id).toBe("a2");
    expect(findNode(root, "a2x")).toBeNull();
    expect(removeNode(root, "root")).toBeNull();
  });

  it("moves between parents and reorders in the same parent", () => {
    const root = sample();
    expect(moveNode(root, "a1", "b", 0, canHaveChildren)).toBe(true);
    expect(ids(findNode(root, "b")!.node)).toEqual(["a1"]);
    expect(moveNode(root, "a", "root", 2, canHaveChildren)).toBe(true);
    expect(ids(root)).toEqual(["b", "a"]);
  });

  it("refuses a move into itself, a descendant, or a leaf", () => {
    const root = sample();
    expect(moveNode(root, "a", "a", 0, canHaveChildren)).toBe(false);
    expect(moveNode(root, "a", "a2x", 0, canHaveChildren)).toBe(false);
    expect(moveNode(root, "b", "a1", 0, canHaveChildren)).toBe(false);
    expect(moveNode(root, "root", "b", 0, canHaveChildren)).toBe(false);
  });

  it("duplicates with fresh ids and unique html ids", () => {
    const root = sample();
    assignMissingHtmlIds(root);
    const copy = duplicateNode(root, "a", true)!;
    expect(ids(root)).toEqual(["a", copy.id, "b"]);
    const all: string[] = [];
    const internal: string[] = [];
    walkElements(root, (node) => {
      internal.push(node.id);
      if (node.htmlId) all.push(node.htmlId);
    });
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(internal).size).toBe(internal.length);
    expect(duplicateNode(root, "root", true)).toBeNull();
  });

  it("drops html ids on duplicate when generation is off", () => {
    const root = sample();
    findNode(root, "a")!.node.htmlId = "custom";
    const copy = duplicateNode(root, "a", false)!;
    expect(copy.htmlId).toBeUndefined();
  });

  it("sets and clears styles, pruning empty maps", () => {
    const node = n("s", "container");
    setStyle(node, "tablet", "hover", "color", "red");
    expect(getStyle(node, "tablet", "hover", "color")).toBe("red");
    setStyle(node, "tablet", "hover", "color", null);
    expect(node.styles.breakpoints).toEqual({});
    setStyle(node, "base", "default", "gap", null);
    expect(node.styles.breakpoints).toEqual({});
  });

  it("moves or discards styles when a breakpoint is removed", () => {
    const root = sample();
    const target = findNode(root, "a")!.node;
    setStyle(target, "tablet", "default", "color", "red");
    setStyle(target, "base", "default", "color", "blue");
    expect(anyStylesAt(root, "tablet")).toBe(true);
    reassignBreakpointStyles(root, "tablet", "base");
    expect(getStyle(target, "base", "default", "color")).toBe("blue");
    expect(anyStylesAt(root, "tablet")).toBe(false);
    setStyle(target, "mobile", "default", "color", "x");
    reassignBreakpointStyles(root, "mobile", null);
    expect(anyStylesAt(root, "mobile")).toBe(false);
  });
});

describe("element menu operations", () => {
  it("shifts among siblings and stops at the edges", () => {
    const root = sample();
    expect(shiftNode(root, "a", -1)).toBe(false);
    expect(shiftNode(root, "a", 1)).toBe(true);
    expect(root.children.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("indents into the previous container and outdents after the parent", () => {
    const root = sample();
    expect(indentNode(root, "b", canHaveChildren)).toBe(true);
    expect(findNode(root, "b")?.parent?.id).toBe("a");
    expect(outdentNode(root, "b")).toBe(true);
    expect(root.children.map((c) => c.id)).toEqual(["a", "b"]);
    expect(outdentNode(root, "a")).toBe(false);
    expect(indentNode(root, "a2x", canHaveChildren)).toBe(false);
  });

  it("wraps a node and unwraps it again", () => {
    const root = sample();
    expect(wrapNode(root, "a1", n("w", "container"))).toBe(true);
    expect(findNode(root, "a1")?.parent?.id).toBe("w");
    expect(findNode(root, "w")?.parent?.id).toBe("a");
    expect(unwrapNode(root, "w")).toBe(true);
    expect(findNode(root, "a1")?.parent?.id).toBe("a");
    expect(unwrapNode(root, "b")).toBe(false);
  });
});

describe("isElementNameTaken", () => {
  it("finds another element with the same name, ignoring case and the element itself", () => {
    const root = emptyPageTree();
    const a = { ...emptyPageTree(), id: "a", name: "Hero" };
    const b = { ...emptyPageTree(), id: "b", name: "Footer" };
    root.children.push(a, b);
    expect(isElementNameTaken(root, "hero", "b")).toBe(true);
    expect(isElementNameTaken(root, "Hero", "a")).toBe(false);
    expect(isElementNameTaken(root, "New", "a")).toBe(false);
  });
});
