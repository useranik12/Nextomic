import { describe, expect, it } from "vitest";
import { newElementQuery } from "./query";
import {
  fillFrom,
  fillWith,
  filterInput,
  queryTemplates,
  restQueryValues,
  restRows,
  supabaseQueryRequest,
  supabaseRows
} from "./query-run";
import { newRestCall, restVariableSchema, type RestCall } from "./rest";
import type { SupabaseColumn, SupabaseTable } from "./supabase";

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

const table: SupabaseTable = {
  name: "posts",
  kind: "view",
  description: null,
  operations: ["select"],
  columns: [
    col("id", { type: "int", pgType: "bigint" }),
    col("title"),
    col("tags", { isList: true, pgType: "text[]" }),
    col("live", { type: "boolean", pgType: "boolean" })
  ]
};

describe("query requests", () => {
  it("types filled values for their column and operator", () => {
    expect(filterInput(col("n", { type: "int" }), "gt", "5")).toBe(5);
    expect(filterInput(col("n", { type: "int" }), "in", "1, 2,")).toEqual([1, 2]);
    expect(filterInput(col("t"), "is", "NULL")).toBeNull();
    expect(filterInput(col("l", { isList: true }), "contains", "a,b")).toEqual(["a", "b"]);
    expect(filterInput(col("j", { type: "json" }), "contains", '{"a":1}')).toEqual({ a: 1 });
    expect(() => filterInput(col("n", { type: "int" }), "eq", "abc")).toThrow("not a number");
  });

  it("builds a Supabase select, leaving out filters whose value is empty", () => {
    const query = {
      ...newElementQuery().supabase,
      table: "posts",
      limit: 10,
      filters: [
        { id: "a", column: "title", operator: "ilike" as const, value: "%{{param.q}}%" },
        { id: "b", column: "id", operator: "gt" as const, value: "{{param.min}}" },
        { id: "c", column: "live", operator: "eq" as const, value: "true" }
      ],
      order: [{ id: "o", column: "id", ascending: false }]
    };
    const fill = fillWith({ param: { q: "news", min: "" } });
    expect(supabaseQueryRequest(query, table, fill, 20)).toEqual({
      resourceId: "view:posts",
      params: {
        op: "select",
        schema: "public",
        filters: [
          { column: "title", operator: "ilike", value: "%news%" },
          { column: "live", operator: "eq", value: true }
        ],
        order: [{ column: "id", ascending: false }],
        limit: 10,
        offset: 20
      }
    });
    expect(supabaseQueryRequest({ ...query, single: true }, table, fill, 20).params).toMatchObject({
      limit: 1
    });
    expect(supabaseRows({ ...query, limit: 2 }, [{ id: 1 }, { id: 2 }]).hasMore).toBe(true);
  });

  it("fills REST values and pages through the chosen JSON path", () => {
    const call: RestCall = {
      ...newRestCall("c1", null, "Feed"),
      variables: [restVariableSchema.parse({ id: "v", name: "q" })],
      response: {
        parseAsDataType: false,
        dataTypeId: "",
        isList: false,
        jsonPaths: [{ id: "p", path: "$.data", name: "data", type: "json", ref: "", isList: true }]
      }
    };
    const rest = {
      ...newElementQuery().rest,
      callId: "c1",
      values: { q: "{{param.q}}" },
      listPath: "p",
      limit: 2
    };
    expect(restQueryValues(rest, call.variables, fillWith({ param: { q: "x" } }))).toEqual({
      q: "x"
    });
    expect(restQueryValues(rest, call.variables, fillWith({ param: {} }))).toEqual({});
    const json = { data: [1, 2, 3] };
    expect(restRows(rest, call, json)).toEqual({ rows: [1, 2], hasMore: true });
    expect(restRows(rest, call, json, 2)).toEqual({ rows: [3], hasMore: false });
    expect(restRows({ ...rest, listPath: "", single: true }, call, json).rows).toEqual([json]);
  });

  it("lists templates and fills from values resolved elsewhere", () => {
    const query = newElementQuery();
    query.supabase.filters = [
      { id: "a", column: "title", operator: "eq", value: "{{param.q}}" },
      { id: "b", column: "title", operator: "eq", value: "{{param.q}}" }
    ];
    expect(queryTemplates(query)).toEqual(["{{param.q}}"]);
    const fill = fillFrom({ "{{param.q}}": "hi" });
    expect([fill("{{param.q}}"), fill("static"), fill("{{other}}")]).toEqual(["hi", "static", ""]);
  });
});
