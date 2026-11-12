import { describe, expect, it } from "vitest";
import {
  actionRunRequestSchema,
  actionSlots,
  columnInput,
  findServerAction,
  getAction,
  isServerAction,
  splitTableRef,
  supabaseActionCall,
  withActionValues,
  QueryInputError,
  type FlowNode,
  type SupabaseColumn,
  type SupabaseTable
} from "../index";

const column = (name: string, type: SupabaseColumn["type"], extra: Partial<SupabaseColumn> = {}) =>
  ({
    name,
    pgType: type,
    type,
    isList: false,
    nullable: true,
    primaryKey: name === "id",
    references: null,
    enumValues: null,
    hasDefault: false,
    description: null,
    ...extra
  }) as SupabaseColumn;

const todos: SupabaseTable = {
  name: "todos",
  kind: "table",
  description: null,
  operations: ["select", "insert", "update", "delete"],
  columns: [
    column("id", "int"),
    column("title", "string"),
    column("done", "boolean"),
    column("meta", "json"),
    column("tags", "string", { isList: true })
  ]
};
const find = (schema: string, table: string) =>
  schema === "public" && table === "todos" ? todos : null;

const def = (type: string) => {
  const found = getAction(type);
  if (!found) throw new Error(`no action ${type}`);
  return found;
};

describe("server action slots", () => {
  const insert = def("supabase.insert");
  const params = {
    table: "todos",
    values: [
      { column: "title", value: "{{ state.title }}" },
      { column: "done", value: "false" }
    ]
  };

  it("lists only tag-holding texts, in fixed order", () => {
    expect(actionSlots(insert, params)).toEqual(["{{ state.title }}"]);
  });

  it("fills slots by position and keeps fixed text as saved", () => {
    const next = withActionValues(insert, params, ["Buy milk"]);
    expect(next.values).toEqual([
      { column: "title", value: "Buy milk" },
      { column: "done", value: "false" }
    ]);
    expect(params.values[0]?.value).toBe("{{ state.title }}");
  });

  it("a missing value becomes empty text", () => {
    const next = withActionValues(insert, params, []);
    expect((next.values as { value: string }[])[0]?.value).toBe("");
  });

  it("cannot change a fixed field through values", () => {
    const next = withActionValues(insert, params, ["x", "drop table", "y"]);
    expect(next.table).toBe("todos");
    expect((next.values as { value: string }[])[1]?.value).toBe("false");
  });
});

describe("findServerAction", () => {
  const nodes = [
    { id: "a1", kind: "action", type: "supabase.insert", params: { table: "todos" } },
    { id: "a2", kind: "action", type: "supabase.delete", params: {}, disabled: true },
    { id: "a3", kind: "action", type: "navigate", params: {} }
  ] as unknown as FlowNode[];

  it("finds an enabled server action", () => {
    expect(findServerAction([nodes], "a1")?.def.type).toBe("supabase.insert");
  });
  it("ignores disabled, non-server and unknown nodes", () => {
    expect(findServerAction([nodes], "a2")).toBeNull();
    expect(findServerAction([nodes], "a3")).toBeNull();
    expect(findServerAction([nodes], "zzz")).toBeNull();
  });
  it("isServerAction matches the supported types", () => {
    expect(isServerAction("rest.call")).toBe(true);
    expect(isServerAction("auth.login")).toBe(false);
  });
});

describe("columnInput", () => {
  it("types values for their column", () => {
    expect(columnInput(column("n", "int"), "4.9")).toBe(4);
    expect(columnInput(column("n", "float"), "4.5")).toBe(4.5);
    expect(columnInput(column("b", "boolean"), "true")).toBe(true);
    expect(columnInput(column("j", "json"), '{"a":1}')).toEqual({ a: 1 });
    expect(columnInput(column("l", "string", { isList: true }), "a, b,,c")).toEqual([
      "a",
      "b",
      "c"
    ]);
    expect(columnInput(column("t", "string"), "hi")).toBe("hi");
    expect(columnInput(column("t", "string"), "  ")).toBeNull();
  });
  it("refuses bad input", () => {
    expect(() => columnInput(column("n", "int"), "abc")).toThrow(QueryInputError);
    expect(() => columnInput(column("b", "boolean"), "yes")).toThrow(QueryInputError);
    expect(() => columnInput(column("j", "json"), "{")).toThrow(QueryInputError);
  });
});

describe("supabaseActionCall", () => {
  it("splits table refs", () => {
    expect(splitTableRef("todos")).toEqual({ schema: "public", table: "todos" });
    expect(splitTableRef("app.todos")).toEqual({ schema: "app", table: "todos" });
  });

  it("builds an insert and an upsert", () => {
    const values = [{ column: "title", value: "A" }];
    expect(supabaseActionCall("supabase.insert", { table: "todos", values }, find)).toEqual({
      resourceId: "table:todos",
      params: { op: "insert", schema: "public", values: { title: "A" } }
    });
    const upsert = supabaseActionCall(
      "supabase.upsert",
      { table: "todos", values, onConflict: "id" },
      find
    );
    expect(upsert.params).toMatchObject({ upsert: true, onConflict: "id" });
  });

  it("builds update and delete with typed filters", () => {
    const filters = [{ column: "id", operator: "eq", value: "7" }];
    const update = supabaseActionCall(
      "supabase.update",
      { table: "todos", values: [{ column: "done", value: "true" }], filters },
      find
    );
    expect(update.params).toMatchObject({ op: "update", values: { done: true } });
    const del = supabaseActionCall("supabase.delete", { table: "todos", filters }, find);
    expect(del.params).toMatchObject({ op: "delete" });
    expect((del.params.filters as { value: unknown }[])[0]?.value).toBe(7);
  });

  it("builds a query with limit, order and single", () => {
    const call = supabaseActionCall(
      "supabase.query",
      { table: "todos", order: [{ column: "id", direction: "desc" }], limit: "5", single: "true" },
      find
    );
    expect(call.params).toMatchObject({
      op: "select",
      limit: 1,
      order: [{ column: "id", ascending: false }]
    });
  });

  it("builds an rpc call", () => {
    const call = supabaseActionCall(
      "supabase.rpc",
      { function: "add_one", args: [{ name: "n", value: "3" }] },
      find
    );
    expect(call).toEqual({ resourceId: "rpc:add_one", params: { op: "rpc", args: { n: "3" } } });
  });

  it("refuses unknown tables and columns", () => {
    expect(() => supabaseActionCall("supabase.insert", { table: "nope" }, find)).toThrow(
      QueryInputError
    );
    expect(() =>
      supabaseActionCall(
        "supabase.insert",
        { table: "todos", values: [{ column: "ghost", value: "x" }] },
        find
      )
    ).toThrow(QueryInputError);
    expect(() =>
      supabaseActionCall(
        "supabase.delete",
        { table: "todos", filters: [{ column: "id", operator: "zap", value: "1" }] },
        find
      )
    ).toThrow(QueryInputError);
  });
});

describe("actionRunRequestSchema", () => {
  it("accepts a valid request and defaults values", () => {
    expect(actionRunRequestSchema.parse({ mode: "live", node: "a1" }).values).toEqual([]);
  });
  it("rejects a bad mode or empty node", () => {
    expect(actionRunRequestSchema.safeParse({ mode: "x", node: "a1" }).success).toBe(false);
    expect(actionRunRequestSchema.safeParse({ mode: "live", node: "" }).success).toBe(false);
  });
});
