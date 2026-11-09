import { describe, expect, it } from "vitest";
import type { ElementNode } from "./element";
import {
  elementQuerySchema,
  localLoopQuerySchema,
  queryProblems,
  type ElementQuery
} from "./query";
import { asLoopList, localLoopRows } from "./query-local";
import { collectLoopRows } from "./query-loop-rows";
import { withLoopScope } from "./query-scope";

const local = (patch: Record<string, unknown>) => localLoopQuerySchema.parse(patch);
const scope = {
  param: { tags: "a, b,,c", ids: "[1,2]" },
  state: { picks: ["x", "y"] },
  app: { cart: [{ sku: 1 }, { sku: 2 }, { sku: 3 }], name: "solo" },
  const: { sizes: '["S","M"]' }
};

describe("other loops", () => {
  it("reads lists from page parameters, state, app state and constants", () => {
    expect(localLoopRows(local({ kind: "param", variable: "tags" }), scope).rows).toEqual([
      "a",
      "b",
      "c"
    ]);
    expect(localLoopRows(local({ kind: "param", variable: "ids" }), scope).rows).toEqual([1, 2]);
    expect(localLoopRows(local({ kind: "state", variable: "picks" }), scope).rows).toEqual([
      "x",
      "y"
    ]);
    expect(localLoopRows(local({ kind: "app", variable: "cart" }), scope).rows).toHaveLength(3);
    expect(localLoopRows(local({ kind: "const", variable: "sizes" }), scope).rows).toEqual([
      "S",
      "M"
    ]);
  });

  it("gives no rows for values that are not lists or are missing", () => {
    expect(localLoopRows(local({ kind: "app", variable: "name" }), scope).rows).toEqual([]);
    expect(localLoopRows(local({ kind: "app", variable: "nope" }), scope).rows).toEqual([]);
    expect(localLoopRows(local({ kind: "app", variable: "__proto__" }), scope).rows).toEqual([]);
    expect(asLoopList("a,b", "app")).toEqual([]);
    expect(asLoopList({ a: 1 }, "json")).toEqual([]);
  });

  it("applies offset, limit and single", () => {
    const cart = local({ kind: "app", variable: "cart", offset: 1, limit: 1 });
    expect(localLoopRows(cart, scope)).toEqual({ rows: [{ sku: 2 }], hasMore: true });
    expect(localLoopRows(cart, scope, 1)).toEqual({ rows: [{ sku: 3 }], hasMore: false });
    const single = local({ kind: "app", variable: "cart", single: true });
    expect(localLoopRows(single, scope).rows).toEqual([{ sku: 1 }]);
  });

  it("reads static JSON and expressions", () => {
    expect(localLoopRows(local({ kind: "json", json: '[{"t":1},{"t":2}]' }), scope).rows).toEqual([
      { t: 1 },
      { t: 2 }
    ]);
    expect(localLoopRows(local({ kind: "json", json: "{bad" }), scope).rows).toEqual([]);
    const expr = local({ kind: "expression", expression: "{{ app.cart.map(i => i.sku * 10) }}" });
    expect(localLoopRows(expr, scope).rows).toEqual([10, 20, 30]);
    const failing = local({ kind: "expression", expression: "{{ app.cart.nope() }}" });
    expect(localLoopRows(failing, scope).rows).toEqual([]);
  });

  it("reads a list field of an enclosing loop's row", () => {
    const inner = withLoopScope(scope, [
      { name: "posts", item: { tags: ["news", "tech"], media: [{ sizes: [1, 2] }] }, index: 0 }
    ]);
    const tags = local({ kind: "parent", parentLoop: "posts", field: "tags" });
    expect(localLoopRows(tags, inner).rows).toEqual(["news", "tech"]);
    const deep = local({ kind: "parent", parentLoop: "posts", field: "media[0].sizes" });
    expect(localLoopRows(deep, inner).rows).toEqual([1, 2]);
    expect(localLoopRows(tags, scope).rows).toEqual([]);
  });

  it("reports what is missing", () => {
    const problems = (patch: Record<string, unknown>) =>
      queryProblems(
        elementQuerySchema.parse({ enabled: true, name: "x", source: "local", local: patch }),
        { supabase: null, rest: null }
      );
    expect(problems({ kind: "app" })).toEqual(["Choose a variable."]);
    expect(problems({ kind: "parent" })[0]).toMatch(/Choose the loop/);
    expect(problems({ kind: "parent", parentLoop: "p" })[0]).toMatch(/Write the field/);
    expect(problems({ kind: "json", json: "{}" })[0]).toMatch(/must be an array/);
    expect(problems({ kind: "json", json: "[1]" })).toEqual([]);
    expect(problems({ kind: "expression" })[0]).toMatch(/Write an expression/);
  });

  it("runs nested local loops without the runner", async () => {
    const node = (id: string, children: ElementNode[], query?: ElementQuery): ElementNode => ({
      id,
      type: query ? "container" : "text",
      classIds: [],
      props: {},
      styles: { breakpoints: {} },
      actions: {},
      children,
      ...(query ? { query } : {})
    });
    const q = (name: string, l: Record<string, unknown>) =>
      elementQuerySchema.parse({ enabled: true, name, source: "local", local: l });
    const tree = node("root", [
      node(
        "posts",
        [
          node(
            "tags",
            [node("t", [])],
            q("tags", { kind: "parent", parentLoop: "posts", field: "tags" })
          )
        ],
        q("posts", { kind: "json", json: '[{"tags":["a","b"]},{"tags":["c"]}]' })
      )
    ]);
    const rows = await collectLoopRows(tree, scope, () => {
      throw new Error("the runner must not be called");
    });
    expect(rows.posts?.rows).toHaveLength(2);
    expect(rows["posts#0/tags"]?.rows).toEqual(["a", "b"]);
    expect(rows["posts#1/tags"]?.rows).toEqual(["c"]);
  });
});
