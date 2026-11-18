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

const payload = (resultReads: string[]): RuntimePayload => ({
  projectId: "p",
  mode: "live",
  route: "/",
  search: "",
  flows: {},
  blocks: [],
  deps: {},
  resultReads,
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
    expect(live.readResults()).toEqual({ posts: "[1]" });
    expect(() => live.setResult("posts", "x".repeat(RESULT_LIMIT))).toThrow(/too large/);
    expect(live.results.posts).toBe("[1]");
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
