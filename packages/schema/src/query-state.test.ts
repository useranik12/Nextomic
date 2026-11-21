import { describe, expect, it } from "vitest";
import { buildDynamicContext, createTokenResolver } from "./dynamic-context";
import { defaultPageSettings } from "./page";
import { elementNodeSchema } from "./element";
import { elementQuerySchema } from "./query";
import { loopQueryStates, queryStateOf, queryStateSchema } from "./query-state";

const supabase = elementQuerySchema.parse({
  enabled: true,
  name: "posts",
  source: "supabase",
  supabase: {
    table: "posts",
    limit: 10,
    offset: 20,
    filters: [
      { id: "a", column: "price", operator: "gte", value: "{{ state.min }}" },
      { id: "b", column: "price", operator: "lte", value: "{{ state.max }}" }
    ],
    order: [{ id: "o", column: "created_at", ascending: false }]
  }
});

describe("queryStateOf", () => {
  it("describes a Supabase loop: page, sort, and every filter with its filled value", () => {
    const fill = (t: string) => t.replace("{{ state.min }}", "5").replace("{{ state.max }}", "50");
    const state = queryStateOf(supabase, fill, { count: 10, hasMore: true });
    expect(state).toMatchObject({
      source: "supabase",
      limit: 10,
      offset: 20,
      page: 3,
      count: 10,
      hasMore: true,
      orderBy: "created_at",
      direction: "desc"
    });
    // A price range is two filters on one column: neither is dropped.
    expect(state.filters).toEqual([
      { column: "price", operator: "gte", value: "5" },
      { column: "price", operator: "lte", value: "50" }
    ]);
    expect(queryStateSchema.safeParse(state).success).toBe(true);
  });

  it("uses one row for a single-row loop and the REST and local settings otherwise", () => {
    const single = elementQuerySchema.parse({
      ...supabase,
      supabase: { ...supabase.supabase, single: true }
    });
    expect(queryStateOf(single, (t) => t, { count: 1, hasMore: false })).toMatchObject({
      limit: 1,
      page: 21
    });
    const rest = elementQuerySchema.parse({
      enabled: true,
      name: "r",
      source: "rest",
      rest: { limit: 5, offset: 10 }
    });
    expect(queryStateOf(rest, (t) => t, { count: 5, hasMore: true })).toMatchObject({
      limit: 5,
      offset: 10,
      page: 3,
      orderBy: "",
      direction: "asc",
      filters: []
    });
  });

  it("never carries REST variable values to the page", () => {
    const rest = elementQuerySchema.parse({
      enabled: true,
      name: "r",
      source: "rest",
      rest: { values: { key: "{{ user.accessToken }}" } }
    });
    expect(
      JSON.stringify(queryStateOf(rest, () => "SECRET", { count: 0, hasMore: false }))
    ).not.toContain("SECRET");
  });
});

describe("loopQueryStates", () => {
  const tree = elementNodeSchema.parse({
    id: "root",
    type: "section",
    children: [
      {
        id: "list",
        type: "container",
        query: supabase,
        children: [{ id: "inner", type: "container", query: { ...supabase, name: "comments" } }]
      },
      { id: "nameless", type: "container", query: { ...supabase, name: "" } },
      { id: "broken", type: "container", query: { ...supabase, name: "broken" } }
    ]
  });

  it("lists named top-level loops that ran, not nested ones, nameless ones or failed ones", () => {
    const rows = {
      list: { rows: [{ id: 1 }, { id: 2 }], hasMore: false },
      "list#0/inner": { rows: [], hasMore: false },
      nameless: { rows: [], hasMore: false },
      broken: { rows: [], hasMore: false, failed: true }
    };
    const states = loopQueryStates(tree, rows, { state: { min: "1", max: "9" } });
    expect(Object.keys(states)).toEqual(["posts"]);
    expect(states.posts).toMatchObject({ count: 2, hasMore: false });
    expect(states.posts?.filters.map((f) => f.value)).toEqual(["1", "9"]);
  });
});

describe("queries in dynamic data", () => {
  const page = elementNodeSchema.parse({
    id: "root",
    type: "section",
    children: [{ id: "list", type: "container", query: supabase }]
  });
  const context = (mode: "editor" | "live") =>
    buildDynamicContext({
      page: { name: "Home", route: "/", settings: defaultPageSettings() },
      tree: page,
      mode
    });

  it("reads loop state as dynamic data, with arithmetic", () => {
    const withState = {
      ...context("live"),
      queries: loopQueryStates(page, { list: { rows: [{}], hasMore: true } }, {})
    };
    const resolve = createTokenResolver(withState);
    expect(resolve("queries.posts.page")).toBe("3");
    expect(resolve("queries.posts.offset + queries.posts.limit")).toBe("30");
    expect(resolve("queries.posts.hasMore")).toBe("true");
    expect(resolve("queries.posts.filters[1].column")).toBe("price");
    expect(resolve("queries.nope.limit")).toBe("");
  });

  it("gives the editor stand-in states and a live page none until the server fills them", () => {
    expect(createTokenResolver(context("editor"))("queries.posts.offset")).toBe("20");
    expect(context("live").queries).toEqual({});
  });
});
