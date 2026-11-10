import type { ActionBlock, FlowNode } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { runFlow, type ActionHandler, type RunEnv } from "./engine";

const debug = (message: string, outputName?: string): FlowNode => ({
  id: crypto.randomUUID(),
  kind: "action",
  type: "debug.log",
  params: { message },
  outputName
});

function env(extra: Partial<RunEnv> = {}) {
  const logged: unknown[] = [];
  const log: ActionHandler = (params) => {
    logged.push(params.message);
    return params.message;
  };
  const value: RunEnv = {
    baseScope: () => ({ app: { n: 2 } }),
    handlers: { "debug.log": log },
    blocks: [],
    elementId: null,
    ...extra
  };
  return { env: value, logged };
}

const loop = (list: string, start: string, end: string, step: string, nodes: FlowNode[]) =>
  ({
    id: "l",
    kind: "loop",
    mode: "forEach",
    list,
    itemName: "loop_abc123_items",
    start,
    end,
    step,
    maxIterations: 100,
    nodes
  }) as FlowNode;

describe("flow engine", () => {
  it("fills tags and passes outputs to later nodes", async () => {
    const { env: e, logged } = env();
    await runFlow([debug("n={{ app.n }}", "first"), debug("{{ first }}!")], e);
    expect(logged).toEqual(["n=2", "n=2!"]);
  });

  it("loops with start, end and step, and stops on break", async () => {
    const { env: e, logged } = env();
    await runFlow(
      [loop("{{ [10, 20, 30, 40, 50] }}", "1", "", "2", [debug("{{ loop_abc123_items.item }}")])],
      e
    );
    expect(logged).toEqual([20, 40]);
    const { env: e2, logged: l2 } = env();
    await runFlow(
      [
        loop("{{ [1, 2, 3] }}", "", "", "", [
          debug("{{ loop_abc123_items.index }}"),
          { id: "b", kind: "break" }
        ])
      ],
      e2
    );
    expect(l2).toEqual([0]);
  });

  it("catches errors and exposes { code, message }", async () => {
    const { env: e, logged } = env();
    const missing: FlowNode = { id: "m", kind: "action", type: "toast", params: {} };
    await runFlow(
      [
        {
          id: "t",
          kind: "tryCatch",
          errorName: "err",
          try: [missing],
          catch: [debug("{{ err.code }}")]
        }
      ],
      e
    );
    expect(logged).toEqual(["not-available"]);
    await expect(runFlow([missing], e)).rejects.toThrow("does not run yet");
  });

  it("runs Action Blocks with params and a return value", async () => {
    const block: ActionBlock = {
      id: "b1",
      name: "Greet",
      description: "",
      params: [{ id: "p1", name: "who", type: "string", isList: false, ref: "", required: true }],
      returns: { type: "string", isList: false, ref: "", value: "hi {{ params.who }}" },
      nodes: []
    };
    const { env: e, logged } = env({ blocks: [block] });
    await runFlow(
      [
        { id: "c", kind: "block", blockId: "b1", params: { p1: "Ann" }, outputName: "greeting" },
        debug("{{ greeting }}")
      ],
      e
    );
    expect(logged).toEqual(["hi Ann"]);
  });

  it("picks the first branch that holds", async () => {
    const { env: e, logged } = env();
    await runFlow(
      [
        {
          id: "c",
          kind: "condition",
          branches: [
            {
              id: "b",
              group: {
                id: "g",
                match: "all",
                items: [{ id: "i", kind: "value", left: "{{ app.n }}", op: "eq", right: "3" }]
              },
              nodes: [debug("three")]
            }
          ],
          else: [debug("other")]
        } as unknown as FlowNode
      ],
      e
    );
    expect(logged).toEqual(["other"]);
  });
});
