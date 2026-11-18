import { describe, expect, it } from "vitest";
import { elementNodeSchema } from "./element";
import { elementQuerySchema, localLoopQuerySchema } from "./query";
import { localLoopRows } from "./query-local";
import {
  listFieldsOf,
  loopResultName,
  loopShapeProblems,
  parentFieldProblem,
  rowFields,
  type RowShapeContext
} from "./query-shape";
import { stateDependencies } from "./state-deps";

const ctx: RowShapeContext = {
  columns: (ref) =>
    ref === "public.posts"
      ? [
          { name: "id", type: "int" },
          { name: "tags", type: "string", isList: true },
          { name: "meta", type: "json" }
        ]
      : ref === "public.plain"
        ? [{ name: "id", type: "int" }]
        : null,
  restFields: () => null,
  resultShape: (name) => (name === "posts" ? [{ name: "title", type: "string" }] : null)
};

const loop = (
  id: string,
  name: string,
  query: Record<string, unknown>,
  children: unknown[] = []
) => ({
  id,
  type: "container",
  props: {},
  query: elementQuerySchema.parse({ name, enabled: true, ...query }),
  children
});
const tree = (parent: Record<string, unknown>, field: string) =>
  elementNodeSchema.parse({
    id: "root",
    type: "section",
    children: [
      loop("a", "posts", parent, [
        loop("b", "tags", {
          source: "local",
          local: { kind: "parent", parentLoop: "posts", field }
        })
      ])
    ]
  });
const supabase = (table: string) => ({ source: "supabase", supabase: { schema: "public", table } });

describe("result loops", () => {
  it("reads a kept result as the list, from the results scope", () => {
    const local = localLoopQuerySchema.parse({ kind: "result", variable: "posts" });
    expect(localLoopRows(local, { results: { posts: [{ title: "A" }] } }).rows).toEqual([
      { title: "A" }
    ]);
    expect(localLoopRows(local, { results: {} }).rows).toEqual([]);
  });

  it("knows the row fields of a kept result, also written as an expression", () => {
    const named = localLoopQuerySchema.parse({ kind: "result", variable: "posts" });
    const written = localLoopQuerySchema.parse({
      kind: "expression",
      expression: "{{ results.posts }}"
    });
    expect(loopResultName(named)).toBe("posts");
    expect(loopResultName(written)).toBe("posts");
    expect(
      loopResultName(
        localLoopQuerySchema.parse({ kind: "expression", expression: "{{ results.posts[0] }}" })
      )
    ).toBeNull();
    const query = elementQuerySchema.parse({ enabled: true, source: "local", local: written });
    expect(rowFields(query, ctx)?.map((f) => f.name)).toEqual(["title"]);
  });

  it("redraws the loop when its state, app state or result changes", () => {
    const deps = stateDependencies(
      elementNodeSchema.parse({
        id: "root",
        type: "section",
        children: [
          loop("a", "x", { source: "local", local: { kind: "result", variable: "posts" } }),
          loop("b", "y", { source: "local", local: { kind: "state", variable: "open" } }),
          loop("c", "z", { source: "local", local: { kind: "app", variable: "cart" } })
        ]
      })
    );
    expect(deps.a).toEqual(["results.posts"]);
    expect(deps.b).toEqual(["state.open"]);
    expect(deps.c).toEqual(["app.cart"]);
  });
});

describe("parent list field", () => {
  it("lists list and JSON fields only", () => {
    expect(listFieldsOf(ctx.columns("public.posts") ?? []).map((f) => f.name)).toEqual([
      "tags",
      "meta"
    ]);
  });

  it("accepts a list or JSON field, with a deeper path", () => {
    expect(parentFieldProblem("tags", "posts", ctx.columns("public.posts"))).toBeNull();
    expect(parentFieldProblem("meta.sizes[0].x", "posts", ctx.columns("public.posts"))).toBeNull();
  });

  it("refuses a field that is not a list, or rows with no list field", () => {
    expect(parentFieldProblem("id", "posts", ctx.columns("public.posts"))).toMatch(/not a list/);
    expect(parentFieldProblem("id", "plain", ctx.columns("public.plain"))).toMatch(/no list/);
  });

  it("never blocks while the shape is unknown", () => {
    expect(parentFieldProblem("anything", "x", null)).toBeNull();
  });

  it("finds the loops a publish must refuse", () => {
    expect(loopShapeProblems(tree(supabase("posts"), "tags"), ctx)).toEqual([]);
    expect(loopShapeProblems(tree(supabase("posts"), "id"), ctx)).toHaveLength(1);
    expect(loopShapeProblems(tree(supabase("plain"), "id"), ctx)).toHaveLength(1);
    expect(
      loopShapeProblems(tree({ source: "local", local: { kind: "json", json: "[]" } }, "x"), ctx)
    ).toEqual([]);
  });
});
