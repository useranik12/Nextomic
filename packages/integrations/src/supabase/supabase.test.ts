import { describe, expect, it } from "vitest";
import { supabaseConfigSchema, supabaseConnector } from "./connector";
import { openApiSchema, readFunctions, readTables } from "./openapi";
import { parseResourceId, supabaseRequestSchema, tableQuery } from "./query";
import {
  fillWith,
  newElementQuery,
  supabaseQueryRequest,
  supabaseRows,
  supabaseTableSchema,
  type SupabaseTable
} from "@nextomic/schema";

const doc = openApiSchema.parse({
  swagger: "2.0",
  definitions: {
    users: {
      description: "The main Users details table.",
      required: ["user_id", "email"],
      properties: {
        user_id: {
          description: "Note:\nThis is a Primary Key.<pk/>",
          format: "bigint",
          type: "integer"
        },
        email: { format: "text", type: "string" },
        joined_at: { default: "now()", format: "timestamp with time zone", type: "string" },
        tags: { format: "text[]", type: "array", items: { type: "string" } },
        team_id: {
          description: "Note:\nThis is a Foreign Key to `teams.id`.<fk table='teams' column='id'/>",
          format: "uuid",
          type: "string"
        },
        status: { format: "user_status", type: "string", enum: ["active", "banned"] },
        settings: { format: "jsonb" },
        verified: { format: "boolean", type: "boolean" }
      }
    },
    users_view: { properties: { email: { format: "text", type: "string" } } },
    orphan: { properties: {} }
  },
  paths: {
    "/": { get: {} },
    "/users": { get: {}, post: {}, patch: {}, delete: {} },
    "/users_view": { get: {} },
    "/rpc/add_credits": {
      post: {
        parameters: [
          {
            in: "body",
            name: "args",
            schema: { properties: { amount: { format: "integer" }, note: { format: "text" } } }
          },
          { $ref: "#/parameters/preferParams" }
        ]
      }
    }
  }
});

describe("supabase schema reading", () => {
  const tables = readTables(doc);
  const users = tables.find((t) => t.name === "users");

  it("lists tables and views that have a path, sorted", () => {
    expect(tables.map((t) => [t.name, t.kind])).toEqual([
      ["users", "table"],
      ["users_view", "view"]
    ]);
    expect(users?.operations).toEqual(["select", "insert", "update", "delete"]);
    expect(users?.description).toBe("The main Users details table.");
  });

  it("maps columns: keys, types, lists, enums, defaults, nullability", () => {
    const col = (name: string) => users?.columns.find((c) => c.name === name);
    expect(col("user_id")).toMatchObject({
      primaryKey: true,
      type: "int",
      nullable: false,
      description: null
    });
    expect(col("email")).toMatchObject({ type: "string", nullable: false, primaryKey: false });
    expect(col("user_id")?.pgType).toBe("int8");
    expect(col("verified")?.pgType).toBe("bool");
    expect(col("joined_at")?.pgType).toBe("timestamptz");
    expect(col("joined_at")).toMatchObject({
      type: "timestamptz",
      hasDefault: true,
      nullable: true
    });
    expect(col("tags")).toMatchObject({ type: "string", isList: true, pgType: "text[]" });
    expect(col("team_id")).toMatchObject({ references: "teams.id", type: "string" });
    expect(col("status")).toMatchObject({ enumValues: ["active", "banned"], type: "string" });
    expect(col("settings")).toMatchObject({ type: "json" });
    expect(col("verified")).toMatchObject({ type: "boolean" });
  });

  it("reads functions and their body parameters", () => {
    expect(readFunctions(doc)).toEqual([
      {
        name: "add_credits",
        params: [
          { name: "amount", pgType: "integer" },
          { name: "note", pgType: "text" }
        ]
      }
    ]);
  });

  it("keeps structure only: no row values anywhere", () => {
    const text = JSON.stringify({ tables, functions: readFunctions(doc) });
    expect(text).not.toContain("now()");
  });
});

describe("supabase requests", () => {
  it("builds a filtered, ordered, paged select", () => {
    const request = supabaseRequestSchema.parse({
      op: "select",
      select: "id, title, author:profiles(name)",
      filters: [
        { column: "status", operator: "eq", value: "live" },
        { column: "tag", operator: "in", value: ["a,b", "c"] },
        { column: "deleted_at", operator: "is", value: null }
      ],
      order: [{ column: "created_at", ascending: false }],
      limit: 20,
      offset: 40
    });
    expect(tableQuery(request).toString()).toBe(
      "status=eq.live&tag=in.%28%22a%2Cb%22%2Cc%29&deleted_at=is.null&select=id%2Ctitle%2Cauthor%3Aprofiles%28name%29&order=created_at.desc&limit=20&offset=40"
    );
  });

  it("builds containment filters for array and JSON columns", () => {
    const request = supabaseRequestSchema.parse({
      op: "select",
      filters: [
        { column: "tags", operator: "contains", value: ["news", "a b"] },
        { column: "ids", operator: "overlaps", value: [1, 2] },
        { column: "meta", operator: "containedBy", value: { plan: "pro" } }
      ]
    });
    expect(decodeURIComponent(tableQuery(request).toString())).toBe(
      'tags=cs.{news,"a+b"}&ids=ov.{1,2}&meta=cd.{"plan":"pro"}'
    );
  });

  it("refuses unsafe names, update/delete without filters, and odd select lists", () => {
    expect(
      supabaseRequestSchema.safeParse({
        op: "select",
        filters: [{ column: "a;drop", operator: "eq", value: 1 }]
      }).success
    ).toBe(false);
    expect(
      supabaseRequestSchema.safeParse({ op: "update", values: { a: 1 }, filters: [] }).success
    ).toBe(false);
    expect(supabaseRequestSchema.safeParse({ op: "delete", filters: [] }).success).toBe(false);
    expect(supabaseRequestSchema.safeParse({ op: "select", select: "id&limit=1" }).success).toBe(
      false
    );
  });

  it("builds an upsert with conflict columns and refuses bad ones", () => {
    const request = supabaseRequestSchema.parse({
      op: "insert",
      values: { id: 1, title: "A" },
      upsert: true,
      onConflict: "id,slug"
    });
    expect(tableQuery(request).toString()).toBe("on_conflict=id%2Cslug&select=*");
    expect(supabaseRequestSchema.parse({ op: "insert", values: { a: 1 } })).toMatchObject({
      upsert: false
    });
    expect(
      tableQuery(
        supabaseRequestSchema.parse({ op: "insert", values: { a: 1 }, upsert: true })
      ).toString()
    ).toBe("select=*");
    expect(
      supabaseRequestSchema.safeParse({
        op: "insert",
        values: { a: 1 },
        upsert: true,
        onConflict: "id;drop"
      }).success
    ).toBe(false);
  });

  it("accepts a schema per table request and a storage sign request", () => {
    expect(supabaseRequestSchema.parse({ op: "select", schema: "billing" })).toMatchObject({
      schema: "billing"
    });
    expect(supabaseRequestSchema.safeParse({ op: "select", schema: "bad-name" }).success).toBe(
      false
    );
    expect(supabaseRequestSchema.parse({ op: "storage.sign", path: "a/b.png" })).toEqual({
      op: "storage.sign",
      path: "a/b.png",
      expiresIn: 600
    });
    expect(
      supabaseRequestSchema.safeParse({ op: "storage.sign", path: "a.png", expiresIn: 10 }).success
    ).toBe(false);
  });

  it("parses resource ids", () => {
    expect(parseResourceId("table:users")).toEqual({ kind: "table", name: "users" });
    expect(parseResourceId("bucket:app-uploads")).toEqual({ kind: "bucket", name: "app-uploads" });
    expect(() => parseResourceId("users")).toThrow();
  });

  it("normalizes the config", () => {
    expect(supabaseConfigSchema.parse({ projectUrl: "https://x.supabase.co/" })).toEqual({
      projectUrl: "https://x.supabase.co",
      schema: "public",
      auth: { google: { enabled: false, webClientId: "" } }
    });
    expect(supabaseConfigSchema.safeParse({ projectUrl: "ftp://x" }).success).toBe(false);
  });
});

// Live check against the owner's test project; runs only when its variables are set.
const url = process.env.E2E_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;

describe.skipIf(!url || !anonKey)("supabase connector against a real project", () => {
  const cfg = supabaseConfigSchema.parse({ projectUrl: url ?? "https://example.invalid" });
  const secrets = { anonKey: anonKey ?? "" };
  const ctx = () => ({
    projectId: "p",
    workspaceId: "w",
    allowPrivateHosts: false,
    signal: AbortSignal.timeout(30_000)
  });

  it("tests the connection and reads tables with the anon key", async () => {
    const result = await supabaseConnector.test(cfg, secrets, ctx());
    expect(result.ok).toBe(true);
    const resources = await supabaseConnector.listResources(cfg, secrets, ctx());
    expect(resources.some((r) => r.kind === "table" || r.kind === "view")).toBe(true);
  }, 60_000);

  it("runs a query loop request built by the schema (first table, two rows, ordered)", async () => {
    const resources = await supabaseConnector.listResources(cfg, secrets, ctx());
    const table = resources
      .map((r) => r.structure)
      .find((t): t is SupabaseTable => supabaseTableSchema.safeParse(t).success);
    expect(table).toBeDefined();
    if (!table?.columns[0]) return;
    const query = {
      ...newElementQuery().supabase,
      table: table.name,
      limit: 2,
      order: [{ id: "o", column: table.columns[0].name, ascending: true }]
    };
    const request = supabaseQueryRequest(query, table, fillWith({}));
    const result = await supabaseConnector.execute(cfg, secrets, request, ctx());
    expect(result.status).toBe(200);
    expect(supabaseRows(query, result.data).rows.length).toBeLessThanOrEqual(2);
  }, 60_000);

  it("reports a wrong key as a failed test, not a crash", async () => {
    const result = await supabaseConnector.test(cfg, { anonKey: "x".repeat(40) }, ctx());
    expect(result.ok).toBe(false);
  }, 30_000);
});
