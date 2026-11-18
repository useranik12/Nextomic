import {
  buildDynamicContext,
  defaultPageSettings,
  RESULT_LIMIT,
  type FlowNode
} from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { runFlow, type RunEnv } from "./engine";
import { LiveState } from "./live-state";
import type { RuntimePayload } from "./payload";

const payload = (resultReads: string[], rereadable: string[] = []): RuntimePayload => ({
  projectId: "p",
  mode: "live",
  route: "/",
  search: "",
  flows: {},
  blocks: [],
  deps: {},
  resultReads,
  rereadable,
  rootIds: [],
  dynamic: buildDynamicContext({
    page: { name: "Home", route: "/", settings: defaultPageSettings() },
    mode: "live"
  }),
  appState: [],
  routes: {},
  themes: []
});

describe("kept action results", () => {
  it("keeps what a shared output answered and reports the change by name", () => {
    const changed: string[][] = [];
    const live = new LiveState(payload(["results.posts"]), {}, null, (names) =>
      changed.push(names)
    );
    live.setResult("posts", [{ title: "A" }]);
    expect(live.results.posts).toBe('[{"title":"A"}]');
    expect(changed).toEqual([["results.posts"]]);
    expect(live.scope().results).toEqual({ posts: [{ title: "A" }] });
    live.setResult("posts", [{ title: "A" }]);
    expect(changed).toHaveLength(1);
  });

  it("sends only the results the page reads, and refuses one that is too large", () => {
    const live = new LiveState(payload(["results.posts"]), {}, null, () => {});
    live.setResult("posts", [1]);
    live.setResult("unused", [2]);
    expect(live.resultRequest()).toEqual({ results: { posts: "[1]" }, resultRefs: {} });
    expect(() => live.setResult("posts", "x".repeat(RESULT_LIMIT))).toThrow(/too large/);
    expect(live.results.posts).toBe("[1]");
  });

  it("sends a reference, not the data, for a large result of a read-only action", () => {
    const live = new LiveState(payload(["results.big"], ["big"]), {}, null, () => {});
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: i, title: "x".repeat(30) }));
    live.setResult("big", rows, { node: "n1", values: ["a"] });
    expect(live.results.big?.length).toBeGreaterThan(RESULT_LIMIT);
    expect(live.resultRequest()).toEqual({
      results: {},
      resultRefs: { big: { node: "n1", values: ["a"] } }
    });
    // Small again: sent as text, and the reference is dropped.
    live.setResult("big", [1], { node: "n1", values: ["a"] });
    expect(live.resultRequest()).toEqual({ results: { big: "[1]" }, resultRefs: {} });
  });

  it("refuses a large result of an action that may write, or without its values", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: i, title: "x".repeat(30) }));
    const writes = new LiveState(payload(["results.big"], []), {}, null, () => {});
    expect(() => writes.setResult("big", rows, { node: "n", values: [] })).toThrow(/read-only/);
    const reads = new LiveState(payload(["results.big"], ["big"]), {}, null, () => {});
    expect(() => reads.setResult("big", rows)).toThrow(/too large/);
  });

  it("shares an output only when its node asks for it", async () => {
    const shared: [string, unknown][] = [];
    const node = (shareOutput: boolean | undefined, name: string): FlowNode => ({
      id: name,
      kind: "action",
      type: "debug.log",
      params: {},
      outputName: name,
      shareOutput
    });
    const env: RunEnv = {
      baseScope: () => ({}),
      handlers: { "debug.log": () => 42 },
      blocks: [],
      elementId: null,
      share: (name, value) => shared.push([name, value])
    };
    await runFlow([node(true, "kept"), node(false, "own"), node(undefined, "old")], env);
    expect(shared).toEqual([["kept", 42]]);
  });
});
