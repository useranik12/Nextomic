import { describe, expect, it } from "vitest";
import { buildDynamicContext, expressionScope } from "../dynamic-context";
import { defaultPageSettings } from "../page";
import { stateRefs } from "../state-deps";
import { RESERVED_STATE_NAMES } from "../state";
import type { FlowNode } from "./flow";
import { rereadableResults, sharedResults } from "./results";

const action = (id: string, outputName: string, extra: Partial<FlowNode> = {}) =>
  ({
    id,
    kind: "action",
    type: "supabase.query",
    params: {},
    outputName,
    shareOutput: true,
    ...extra
  }) as FlowNode;
const flows = (nodes: FlowNode[], disabled = false) => ({
  a: [{ id: "f", trigger: "page.load", settings: {}, nodes, disabled }]
});

describe("sharedResults", () => {
  it("lists kept outputs once, last write wins, and skips disabled and unshared ones", () => {
    const found = sharedResults(
      flows([
        action("1", "posts"),
        action("2", "posts"),
        action("3", "off", { shareOutput: false } as never),
        action("4", "dead", { disabled: true }),
        action("5", "")
      ])
    );
    expect(found.map((r) => [r.name, r.nodeId])).toEqual([["posts", "2"]]);
    expect(sharedResults(flows([action("1", "x")], true))).toEqual([]);
  });
});

describe("rereadableResults", () => {
  const shared = (type: string, params = {}) => ({ name: type, nodeId: "n", type, params });
  it("allows only actions that read", () => {
    const rest = {
      calls: [
        { id: "g", method: "GET" },
        { id: "p", method: "POST" }
      ]
    };
    const found = rereadableResults(
      [
        shared("supabase.query"),
        shared("supabase.insert"),
        shared("supabase.rpc"),
        { ...shared("rest.call", { call: "g" }), name: "get" },
        { ...shared("rest.call", { call: "p" }), name: "post" }
      ],
      rest as never
    );
    expect(found).toEqual(["supabase.query", "get"]);
    expect(rereadableResults([shared("rest.call", { call: "g" })], null)).toEqual([]);
  });
});

describe("results in expressions", () => {
  it("reads kept JSON as values and counts as a state-like dependency", () => {
    const base = buildDynamicContext({
      page: { name: "Home", route: "/", settings: defaultPageSettings() },
      mode: "live"
    });
    const scope = expressionScope({ ...base, results: { posts: '[{"t":"A"}]', note: "plain" } });
    expect(scope.results).toEqual({ posts: [{ t: "A" }], note: "plain" });
    expect(stateRefs("{{ results.posts?.[0]?.t }} and {{ app.x }}").sort()).toEqual([
      "app.x",
      "results.posts"
    ]);
    expect(RESERVED_STATE_NAMES.has("results")).toBe(true);
  });
});
