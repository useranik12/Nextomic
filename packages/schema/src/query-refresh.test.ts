import { describe, expect, it } from "vitest";
import { flowNodeSchema, type FlowNode } from "./actions/flow";
import { elementNodeSchema } from "./element";
import { findNode } from "./tree";
import { activeQuery, elementQuerySchema, type ElementQuery } from "./query";
import {
  applyRefreshes,
  bindProblem,
  findRefreshQuery,
  parseRefreshQuery,
  refreshRequestSchema,
  refreshSlots,
  withSlotValues
} from "./query-refresh";

const supabase = elementQuerySchema.parse({
  enabled: true,
  name: "posts",
  source: "supabase",
  supabase: {
    table: "posts",
    limit: 20,
    realtime: true,
    filters: [{ id: "f1", column: "status", operator: "eq", value: "published" }]
  },
  fallback: { enabled: true, text: "Could not load posts." }
});
const rest = elementQuerySchema.parse({
  enabled: true,
  name: "feed",
  source: "rest",
  rest: { callId: "c1", values: { q: "{{ state.search }}", page: "1" } }
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

/** The owner's edited query: another filter whose value is a tag, and a smaller limit. */
const edited: ElementQuery = {
  ...supabase,
  supabase: {
    ...supabase.supabase,
    limit: 5,
    realtime: false,
    filters: [
      { id: "f1", column: "status", operator: "eq", value: "published" },
      { id: "f2", column: "title", operator: "ilike", value: "%{{ state.search }}%" }
    ]
  }
};

const refreshNode = (params: Record<string, string>): FlowNode =>
  flowNodeSchema.parse({ id: "n1", kind: "action", type: "query.refresh", params });

const queryOf = (t: typeof tree, id: string) => activeQuery(findNode(t, id)?.node ?? { type: "" });

describe("parseRefreshQuery", () => {
  it("reads a saved query and refuses empty text, broken JSON and non-queries", () => {
    expect(parseRefreshQuery(JSON.stringify(edited))?.supabase.limit).toBe(5);
    expect(parseRefreshQuery("")).toBeNull();
    expect(parseRefreshQuery("{oops")).toBeNull();
    expect(parseRefreshQuery(JSON.stringify({ source: 42 }))).toBeNull();
    expect(parseRefreshQuery(["not text"])).toBeNull();
  });
});

describe("refreshSlots and withSlotValues", () => {
  it("lists filter values for Supabase, variable values by name for REST, none for Other Loops", () => {
    expect(refreshSlots(edited)).toEqual(["published", "%{{ state.search }}%"]);
    expect(refreshSlots(rest)).toEqual(["1", "{{ state.search }}"]);
    expect(refreshSlots(local)).toEqual([]);
  });

  it("fills only slots that hold a tag: fixed text cannot be changed by the browser", () => {
    const filled = withSlotValues(edited, ["drafts", "%news%"]);
    expect(filled.supabase.filters.map((f) => f.value)).toEqual(["published", "%news%"]);
    const restFilled = withSlotValues(rest, ["99", "shoes"]);
    expect(restFilled.rest.values).toEqual({ page: "1", q: "shoes" });
  });
});

describe("bound settings", () => {
  const bound = (bind: Record<string, string>) =>
    ({ ...structuredClone(edited), bind }) as ElementQuery;
  const all = bound({
    limit: "{{ queries.posts.limit + 10 }}",
    offset: "{{ queries.posts.offset }}",
    orderColumn: "{{ form.f.sort }}",
    orderDirection: "{{ form.f.dir }}"
  });

  it("puts the bound slots after the filter values, and adds none when nothing is bound", () => {
    expect(refreshSlots(edited)).toHaveLength(2);
    expect(refreshSlots(all)).toHaveLength(6);
    expect(refreshSlots(all).slice(0, 2)).toEqual(["published", "%{{ state.search }}%"]);
    expect(refreshSlots(all)[2]).toBe("{{ queries.posts.limit + 10 }}");
  });

  it("applies limit, offset, sort column and direction from the filled values", () => {
    const filled = withSlotValues(all, ["x", "y", "30", "60", "created_at", "DESC"]);
    expect(filled.supabase).toMatchObject({ limit: 30, offset: 60 });
    expect(filled.supabase.order).toEqual([
      { id: "refresh-order", column: "created_at", ascending: false }
    ]);
    expect("bind" in filled).toBe(false);
  });

  it("changes an existing first sort row and keeps the others", () => {
    const base = bound({ orderColumn: "{{ x }}", orderDirection: "{{ y }}" });
    base.supabase.order = [
      { id: "o1", column: "title", ascending: true },
      { id: "o2", column: "id", ascending: true }
    ];
    const filled = withSlotValues(base, ["", "", "", "", "views", "desc"]);
    expect(filled.supabase.order.map((o) => [o.column, o.ascending])).toEqual([
      ["views", false],
      ["id", true]
    ]);
  });

  it("keeps the saved setting for an invalid or empty value", () => {
    const filled = withSlotValues(all, ["", "", "0", "-5", "a b;--", "sideways"]);
    expect(filled.supabase).toMatchObject({ limit: 5, offset: 0 });
    expect(filled.supabase.order).toEqual([]);
    expect(withSlotValues(all, ["", "", "", "", "", ""]).supabase.limit).toBe(5);
    expect(withSlotValues(all, ["", "", "1001", "", "", ""]).supabase.limit).toBe(5);
  });

  it("never lets a visitor change a setting the owner fixed", () => {
    const fixed = bound({ limit: "10" });
    expect(withSlotValues(fixed, ["", "", "500", "", "", ""]).supabase.limit).toBe(5);
  });

  it("applies limit and offset to REST and Other Loops, and ignores the sort for them", () => {
    const r = withSlotValues(
      { ...rest, bind: { limit: "{{ a }}", offset: "{{ b }}" } } as ElementQuery,
      ["1", "q", "8", "16", "", ""]
    );
    expect(r.rest).toMatchObject({ limit: 8, offset: 16 });
    const l = withSlotValues(
      { ...local, bind: { limit: "{{ a }}", orderColumn: "{{ c }}" } } as ElementQuery,
      ["7", "", "", ""]
    );
    expect(l.local.limit).toBe(7);
  });

  it("reports a bad filled value in words", () => {
    expect(bindProblem(all, ["", "", "12", "0", "created_at", "desc"])).toBeNull();
    expect(bindProblem(all, ["", "", "abc", "0", "c", "asc"])).toMatch(
      /Rows must be a whole number/
    );
    expect(bindProblem(all, ["", "", "5", "-1", "c", "asc"])).toMatch(/Offset must be/);
    expect(bindProblem(all, ["", "", "5", "0", "a;b", "asc"])).toMatch(/not a column name/);
    expect(bindProblem(all, ["", "", "5", "0", "c", "up"])).toMatch(/asc or desc/);
    expect(bindProblem(edited, ["a", "b"])).toBeNull();
  });

  it("is saved with the action and found again with its bound settings stripped from the run", () => {
    const flows = [[refreshNode({ query: "list", override: JSON.stringify(all) })]];
    const saved = findRefreshQuery(flows, "n1", "list");
    expect(saved?.bind.limit).toBe("{{ queries.posts.limit + 10 }}");
    const out = applyRefreshes(
      tree,
      { list: { node: "n1", values: ["a", "b", "25", "", "", ""] } },
      (n, l) => findRefreshQuery(flows, n, l)
    );
    const run = queryOf(out, "list");
    expect(run?.supabase.limit).toBe(25);
    expect(run && "bind" in run).toBe(false);
  });
});

describe("refreshRequestSchema", () => {
  it("takes plain values and refuses tags", () => {
    expect(refreshRequestSchema.safeParse({ list: { node: "n1", values: ["a"] } }).success).toBe(
      true
    );
    expect(refreshRequestSchema.safeParse({ list: { node: "n1", values: null } }).success).toBe(
      true
    );
    expect(
      refreshRequestSchema.safeParse({ list: { node: "n1", values: ["{{ user.id }}"] } }).success
    ).toBe(false);
  });
});

describe("findRefreshQuery", () => {
  const flows = [[refreshNode({ query: "list", override: JSON.stringify(edited) })]];

  it("finds the saved query of the action node for that loop", () => {
    expect(findRefreshQuery(flows, "n1", "list")?.supabase.limit).toBe(5);
  });

  it("finds nothing for another node, another loop, or an action without saved settings", () => {
    expect(findRefreshQuery(flows, "n2", "list")).toBeNull();
    expect(findRefreshQuery(flows, "n1", "feed")).toBeNull();
    expect(findRefreshQuery([[refreshNode({ query: "list" })]], "n1", "list")).toBeNull();
  });
});

describe("applyRefreshes", () => {
  const saved = (nodeId: string, loopId: string) =>
    nodeId === "n1" && loopId === "list" ? edited : null;

  it("runs the saved query with the browser's values, keeping the loop's name and fallback", () => {
    const next = applyRefreshes(
      tree,
      { list: { node: "n1", values: ["ignored", "%news%"] } },
      saved
    );
    const query = queryOf(next, "list");
    expect(query?.supabase.limit).toBe(5);
    expect(query?.supabase.filters.map((f) => f.value)).toEqual(["published", "%news%"]);
    expect(query?.name).toBe("posts");
    expect(query?.fallback).toEqual(supabase.fallback);
    expect(query?.supabase.realtime).toBe(true);
    expect(queryOf(tree, "list")?.supabase.limit).toBe(20);
  });

  it("keeps the saved templates when the browser sends no values", () => {
    const next = applyRefreshes(tree, { list: { node: "n1", values: null } }, saved);
    expect(queryOf(next, "list")?.supabase.filters[1]?.value).toBe("%{{ state.search }}%");
  });

  it("leaves the loop as it is without a saved query or when its type changed", () => {
    expect(
      queryOf(applyRefreshes(tree, { feed: { node: "n1", values: [] } }, saved), "feed")
    ).toEqual(rest);
    const other = applyRefreshes(tree, { feed: { node: "n1", values: [] } }, () => edited);
    expect(queryOf(other, "feed")).toEqual(rest);
  });
});
