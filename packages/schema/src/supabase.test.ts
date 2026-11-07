import { describe, expect, it } from "vitest";
import { appEnumListSchema } from "./state";
import {
  enumInSync,
  enumNameOf,
  mergeSchemaEntry,
  nextomicTypeOf,
  saveSupabaseEnums,
  shortPgType,
  supabaseRowTargets,
  supabaseStructureSchema,
  tableEnums,
  type SupabaseTable
} from "./supabase";

const column = (name: string, pgType: string, enumValues: string[] | null = null) => ({
  name,
  pgType,
  type: "string" as const,
  isList: pgType.endsWith("[]"),
  nullable: true,
  primaryKey: false,
  references: null,
  enumValues,
  hasDefault: false,
  description: null
});

const table: SupabaseTable = {
  name: "orders",
  kind: "table",
  description: null,
  operations: ["select"],
  columns: [
    column("id", "int8"),
    column("status", "public.order_status", ["new", "paid"]),
    column("history", "public.order_status[]", ["new", "paid"]),
    column("size", "size", ["s", "m"])
  ]
};

describe("supabase types", () => {
  it("uses PostgreSQL's short names", () => {
    expect(shortPgType("timestamp with time zone")).toBe("timestamptz");
    expect(shortPgType("timestamp without time zone")).toBe("timestamp");
    expect(shortPgType("character varying(20)")).toBe("varchar(20)");
    expect(shortPgType("text")).toBe("text");
    expect(shortPgType("timestamp with time zone[]")).toBe("timestamptz[]");
    expect(shortPgType("public.task_category[]")).toBe("task_category[]");
    expect(shortPgType("billing.plan")).toBe("billing.plan");
  });

  it("maps whole numbers to Int and the rest to Float", () => {
    expect(nextomicTypeOf("int8")).toBe("int");
    expect(nextomicTypeOf("bigint")).toBe("int");
    expect(nextomicTypeOf("float8")).toBe("float");
    expect(nextomicTypeOf("numeric")).toBe("float");
    expect(nextomicTypeOf("timestamptz")).toBe("timestamptz");
  });
});

describe("supabase enums", () => {
  it("names app enums after the Postgres type, as a valid app name", () => {
    expect(enumNameOf("public.order_status")).toBe("order_status");
    expect(enumNameOf("public.task_category[]")).toBe("task_category");
    expect(enumNameOf("billing.plan")).toBe("billing_plan");
    expect(enumNameOf("public.user")).toBe("user_enum");
  });

  it("lists each enum a table uses once", () => {
    expect(tableEnums(table)).toEqual([
      { name: "order_status", values: ["new", "paid"] },
      { name: "size", values: ["s", "m"] }
    ]);
  });

  it("saves new enums and replaces values of existing ones, order sensitive", () => {
    let n = 0;
    const existing = [{ id: "e1", name: "size", description: "Mine", values: ["m", "s"] }];
    expect(enumInSync(existing, { name: "size", values: ["s", "m"] })).toBe(false);
    const saved = saveSupabaseEnums(existing, tableEnums(table), () => `new${++n}`);
    expect(saved).toEqual([
      { id: "e1", name: "size", description: "Mine", values: ["s", "m"] },
      { id: "new1", name: "order_status", description: "From Supabase", values: ["new", "paid"] }
    ]);
    expect(appEnumListSchema.safeParse(saved).success).toBe(true);
    expect(enumInSync(saved, { name: "size", values: ["s", "m"] })).toBe(true);
  });
});

describe("supabase schemas", () => {
  const table = (name: string): SupabaseTable => ({
    name,
    kind: "table",
    description: null,
    columns: [],
    operations: ["select"]
  });
  const bucket = { name: "media", public: true, objectCount: 1, countCapped: false };

  it("reads a structure saved before schemas were separate as one entry", () => {
    const old = { schema: "public", tables: [table("users")], functions: [], buckets: [bucket] };
    expect(supabaseStructureSchema.parse(old)).toEqual({
      schemas: [{ schema: "public", tables: [table("users")], functions: [] }],
      buckets: [bucket]
    });
  });

  it("merges a fetched schema: replaces the same name, keeps others, public first", () => {
    const first = mergeSchemaEntry(
      null,
      { schema: "billing", tables: [table("plans")], functions: [] },
      []
    );
    const second = mergeSchemaEntry(
      first,
      { schema: "public", tables: [table("users")], functions: [] },
      [bucket]
    );
    const third = mergeSchemaEntry(
      second,
      { schema: "billing", tables: [table("invoices")], functions: [] },
      [bucket]
    );
    expect(third.schemas.map((s) => s.schema)).toEqual(["public", "billing"]);
    expect(third.schemas[1]?.tables.map((t) => t.name)).toEqual(["invoices"]);
    expect(third.buckets).toEqual([bucket]);
  });

  it("names row targets schema.table outside public", () => {
    const structure = mergeSchemaEntry(
      mergeSchemaEntry(null, { schema: "public", tables: [table("users")], functions: [] }, []),
      { schema: "billing", tables: [table("plans")], functions: [] },
      []
    );
    expect(supabaseRowTargets(structure)).toEqual(["users", "billing.plans"]);
    expect(supabaseRowTargets(null)).toEqual([]);
  });
});
