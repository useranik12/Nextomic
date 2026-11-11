import { describe, expect, it } from "vitest";
import { elementNodeSchema } from "./element";
import { elementQuerySchema } from "./query";
import { applyQueryValues, queryValuesSchema, refreshFields } from "./query-refresh";

const supabase = elementQuerySchema.parse({
  enabled: true,
  name: "posts",
  source: "supabase",
  supabase: {
    table: "posts",
    filters: [{ id: "f1", column: "title", operator: "ilike", value: "" }]
  }
});
const rest = elementQuerySchema.parse({
  enabled: true,
  name: "feed",
  source: "rest",
  rest: { callId: "c1" }
});
const local = elementQuerySchema.parse({ enabled: true, name: "l", source: "local" });

const tree = elementNodeSchema.parse({
  id: "root",
  type: "section",
  children: [
    { id: "list", type: "container", query: supabase },
    { id: "feed", type: "container", query: rest }
  ]
});

describe("refreshFields", () => {
  it("lists filter values and Limit for Supabase, variables and Limit for REST, nothing for Other Loops", () => {
    expect(refreshFields(supabase).map((f) => f.name)).toEqual(["filter:f1", "limit"]);
    expect(refreshFields(rest, ["q", "page"]).map((f) => f.name)).toEqual([
      "var:q",
      "var:page",
      "limit"
    ]);
    expect(refreshFields(local)).toEqual([]);
  });

  it("leaves out Limit for a single row", () => {
    const single = elementQuerySchema.parse({
      ...supabase,
      supabase: { ...supabase.supabase, single: true }
    });
    expect(refreshFields(single).map((f) => f.name)).toEqual(["filter:f1"]);
  });
});

describe("applyQueryValues", () => {
  it("sets filter values, REST variables and limits on a copy and ignores unknown names", () => {
    const next = applyQueryValues(tree, {
      list: { "filter:f1": "%hello%", limit: "5", "filter:nope": "x", "var:q": "ignored" },
      feed: { "var:q": "cats", limit: "9999" }
    });
    const list = next.children[0]!.query!;
    expect(list.supabase.filters[0]!.value).toBe("%hello%");
    expect(list.supabase.limit).toBe(5);
    const feed = next.children[1]!.query!;
    expect(feed.rest.values.q).toBe("cats");
    expect(feed.rest.limit).toBe(20);
    expect(tree.children[0]!.query!.supabase.filters[0]!.value).toBe("");
  });

  it("refuses values that hold dynamic tags", () => {
    expect(
      queryValuesSchema.safeParse({ list: { "filter:f1": "{{ user.accessToken }}" } }).success
    ).toBe(false);
  });
});
