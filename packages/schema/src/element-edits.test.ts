import { describe, expect, it } from "vitest";
import { elementNodeSchema } from "./element";
import { applyElementEdits, elementEditsSchema } from "./element-edits";
import { stateDependencies } from "./state-deps";

const node = (raw: Record<string, unknown>) => elementNodeSchema.parse(raw);

const gated = node({
  id: "gated",
  type: "text",
  visibility: {
    group: {
      id: "g",
      match: "all",
      items: [{ id: "c", kind: "class", target: "menu", op: "has", left: "is-open" }]
    }
  }
});
const menu = node({ id: "menu", type: "container", classIds: ["menu"], children: [gated] });
const root = node({ id: "root", type: "section", children: [menu] });

describe("applyElementEdits", () => {
  it("adds and removes classes, sets and drops the ID and attributes, on a copy", () => {
    const edits = elementEditsSchema.parse({
      menu: {
        addClasses: ["is-open"],
        removeClasses: ["menu"],
        htmlId: "main-menu",
        attributes: { "aria-expanded": "true", title: null }
      }
    });
    const next = applyElementEdits(root, edits);
    const edited = next.children[0]!;
    expect(edited.classIds).toEqual(["is-open"]);
    expect(edited.htmlId).toBe("main-menu");
    expect(edited.attributes).toEqual({ "aria-expanded": "true" });
    expect(root.children[0]!.classIds).toEqual(["menu"]);
  });

  it("refuses bad class names, IDs and too many elements", () => {
    expect(elementEditsSchema.safeParse({ a: { addClasses: ["bad name"] } }).success).toBe(false);
    expect(elementEditsSchema.safeParse({ a: { htmlId: "1x" } }).success).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`n${i}`, {}]));
    expect(elementEditsSchema.safeParse(many).success).toBe(false);
  });
});

describe("element condition dependencies", () => {
  it("lists el.<target> for class, ID and attribute conditions", () => {
    expect(stateDependencies(root)).toEqual({ gated: ["el.menu"] });
  });

  it("uses the element itself when a condition has no target", () => {
    const self = node({
      id: "self",
      type: "text",
      visibility: {
        group: {
          id: "g",
          match: "all",
          items: [{ id: "c", kind: "attribute", name: "data-x", op: "has", left: "data-x" }]
        }
      }
    });
    expect(stateDependencies(self)).toEqual({ self: ["el.self"] });
  });
});
