import { describe, expect, it } from "vitest";
import { structureFromResources } from "./supabase-schema";

const column = (name: string) => ({
  name,
  pgType: "text",
  type: "string",
  isList: false,
  nullable: true,
  primaryKey: false,
  references: null,
  enumValues: null,
  hasDefault: false,
  description: null
});

describe("structureFromResources", () => {
  const resources = [
    {
      id: "table:users",
      kind: "table",
      name: "users",
      structure: {
        name: "users",
        kind: "table",
        description: null,
        columns: [column("email"), column("name")],
        operations: ["select"]
      }
    },
    { id: "table:broken", kind: "table", name: "broken", structure: { name: 5 } },
    { id: "rpc:f", kind: "rpc", name: "f", structure: { name: "f", params: [] } },
    {
      id: "bucket:b",
      kind: "bucket",
      name: "b",
      structure: { name: "b", public: true, objectCount: 3, countCapped: false }
    }
  ];

  it("keeps valid resources and drops malformed ones", () => {
    const structure = structureFromResources(resources, "public");
    expect(structure.tables.map((t) => t.name)).toEqual(["users"]);
    expect(structure.functions.map((f) => f.name)).toEqual(["f"]);
    expect(structure.buckets).toEqual([
      { name: "b", public: true, objectCount: 3, countCapped: false }
    ]);
  });
});
