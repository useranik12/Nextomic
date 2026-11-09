import { describe, expect, it } from "vitest";
import { elementNodeSchema, type ElementNode } from "./element";
import { expressionProblem, runExpression } from "./expression";
import {
  activeQuery,
  elementQuerySchema,
  newElementQuery,
  operatorsFor,
  queryLabel,
  queryProblems
} from "./query";
import { loopAncestors, loopDepths, withLoopScope } from "./query-scope";
import { newRestCall, restConfigSchema } from "./rest";
import type { SupabaseColumn, SupabaseStructure } from "./supabase";

const col = (name: string, patch: Partial<SupabaseColumn> = {}): SupabaseColumn => ({
  name,
  pgType: "text",
  type: "string",
  isList: false,
  nullable: true,
  primaryKey: false,
  references: null,
  enumValues: null,
  hasDefault: false,
  description: null,
  ...patch
});

const structure: SupabaseStructure = {
  schemas: [
    {
      schema: "public",
      tables: [
        {
          name: "posts",
          kind: "table",
          description: null,
          operations: ["select"],
          columns: [
            col("id", { pgType: "bigint", type: "int" }),
            col("title"),
            col("tags", { isList: true })
          ]
        }
      ],
      functions: []
    }
  ],
  buckets: []
};

const node = (id: string, patch: object = {}, children: object[] = []): ElementNode =>
  elementNodeSchema.parse({ id, type: "container", ...patch, children });

describe("query model", () => {
  it("defaults to an enabled Supabase list of 20 rows and keeps both sources", () => {
    const query = newElementQuery();
    expect(query).toMatchObject({ enabled: true, source: "supabase" });
    expect(query.supabase).toMatchObject({ single: false, limit: 20, realtime: false });
    expect(query.rest).toMatchObject({ callId: "", listPath: "" });
    expect(elementQuerySchema.safeParse({ supabase: { limit: 5000 } }).success).toBe(false);
  });

  it("runs only on Container and Section, and only when enabled", () => {
    const query = newElementQuery();
    expect(activeQuery({ type: "section", query })).toBe(query);
    expect(activeQuery({ type: "heading", query })).toBeNull();
    expect(activeQuery({ type: "container", query: { ...query, enabled: false } })).toBeNull();
  });

  it("names a query after its element and type", () => {
    expect(queryLabel("Post grid", newElementQuery())).toBe("Post grid (Supabase Query)");
    expect(queryLabel("Feed", { ...newElementQuery(), source: "rest" })).toBe("Feed (REST API)");
  });

  it("offers only the operators a column type accepts", () => {
    expect(operatorsFor(col("n", { type: "int", pgType: "bigint" }))).toContain("gt");
    expect(operatorsFor(col("t"))).toEqual(["eq", "neq", "like", "ilike", "in", "is"]);
    expect(operatorsFor(col("u", { pgType: "uuid" }))).not.toContain("like");
    expect(operatorsFor(col("b", { type: "boolean", pgType: "boolean" }))).toEqual([
      "eq",
      "neq",
      "is"
    ]);
    expect(operatorsFor(col("l", { isList: true }))).toEqual([
      "contains",
      "containedBy",
      "overlaps",
      "is"
    ]);
  });

  it("reports what stops a query from running", () => {
    const sources = { supabase: structure, rest: null };
    const base = newElementQuery();
    expect(queryProblems(base, sources)).toEqual(["Choose a table or view."]);
    const ok = {
      ...base,
      supabase: {
        ...base.supabase,
        table: "posts",
        filters: [{ id: "f", column: "title", operator: "ilike" as const, value: "{{param.q}}" }],
        order: [{ id: "o", column: "id", ascending: false }]
      }
    };
    expect(queryProblems(ok, sources)).toEqual([]);
    const bad = {
      ...ok,
      supabase: {
        ...ok.supabase,
        filters: [{ id: "f", column: "id", operator: "like" as const, value: "1" }]
      }
    };
    expect(queryProblems(bad, sources)[0]).toContain("does not work on id");
    expect(queryProblems(base, { supabase: null, rest: null })[0]).toContain("Connect Supabase");
    const config = restConfigSchema.parse({ calls: [newRestCall("c1", null, "Feed")] });
    const rest = { ...base, source: "rest" as const, rest: { ...base.rest, callId: "c1" } };
    expect(queryProblems(rest, { supabase: null, rest: config })).toEqual([]);
    expect(
      queryProblems(
        { ...rest, rest: { ...rest.rest, listPath: "gone" } },
        { supabase: null, rest: config }
      )
    ).toEqual(["The chosen JSON path was removed from the API call."]);
  });
});

describe("query scope", () => {
  const tree = node("root", { type: "section" }, [
    {
      id: "list",
      type: "container",
      query: { enabled: true },
      children: [
        { id: "card", type: "container", children: [{ id: "title", type: "heading" }] },
        {
          id: "inner",
          type: "container",
          query: { enabled: true },
          children: [{ id: "deep", type: "text" }]
        }
      ]
    },
    { id: "sibling", type: "heading" }
  ]);

  it("gives loop values to descendants only", () => {
    const depths = loopDepths(tree);
    expect(depths.get("list")).toBe(0);
    expect(depths.get("title")).toBe(1);
    expect(depths.get("deep")).toBe(2);
    expect(depths.get("sibling")).toBe(0);
    expect(loopAncestors(tree, "deep").map((n) => n.id)).toEqual(["inner", "list"]);
    expect(loopAncestors(tree, "list")).toEqual([]);
  });

  it("makes %loop tags unknown outside a loop and readable inside", () => {
    expect(expressionProblem("%posts.item.title", withLoopScope({}, []))).toBe(
      'No query loop named "posts" around this element.'
    );
    const inside = withLoopScope({}, [
      { name: "comments", item: { title: "B" }, index: 1 },
      { name: "posts", item: { title: "A" }, index: 0 }
    ]);
    expect(
      expressionProblem("%comments.item.title + %posts.item.title + %comments.index", inside)
    ).toBeNull();
    expect(runExpression("%comments.item.title + %posts.item.title", inside)).toBe("BA");
    expect(inside).toMatchObject({
      "%comments": { item: { title: "B" }, index: 1 },
      "%posts": { item: { title: "A" }, index: 0 }
    });
  });

  it("keeps % as modulo after a value", () => {
    const scope = withLoopScope({ n: 7 }, [{ name: "posts", item: {}, index: 3 }]);
    expect(runExpression("n % 4", scope)).toBe(3);
    expect(runExpression("n %4", scope)).toBe(3);
    expect(runExpression("(n) % 2 + %posts.index", scope)).toBe(4);
  });
});
