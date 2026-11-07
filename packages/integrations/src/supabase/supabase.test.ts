import { describe, expect, it } from "vitest";
import { supabaseConfigSchema, supabaseConnector } from "./connector";
import { openApiSchema, readFunctions, readTables } from "./openapi";
import { parseResourceId, supabaseRequestSchema, tableQuery } from "./query";

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
      type: "number",
      nullable: false,
      description: null
    });
    expect(col("email")).toMatchObject({ type: "string", nullable: false, primaryKey: false });
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
  const cfg = supabaseConfigSchema.parse({ projectUrl: url });
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

  it("reports a wrong key as a failed test, not a crash", async () => {
    const result = await supabaseConnector.test(cfg, { anonKey: "x".repeat(40) }, ctx());
    expect(result.ok).toBe(false);
  }, 30_000);
});
