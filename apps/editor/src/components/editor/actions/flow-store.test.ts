import {
  cloneWithNewIds,
  emptyPageTree,
  pairNodeIds,
  type ElementNode,
  type TriggerFlow
} from "@nextomic/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { useFlowStore } from "./flow-store";

const flow = (id: string): TriggerFlow => ({ id, trigger: "click", settings: {}, nodes: [] });

function tree(): ElementNode {
  const root = emptyPageTree();
  const child = { ...emptyPageTree(), id: "child", type: "container", children: [] };
  const box = { ...emptyPageTree(), id: "box", type: "section", children: [child] };
  return { ...root, id: "root", children: [box] };
}

const owner = { kind: "page" as const, id: "p1" };

beforeEach(() => {
  const store = useFlowStore.getState();
  store.begin("proj", owner, tree());
  store.loaded(owner, { byNode: { child: { flows: [flow("f1")], version: 3 } } });
});

describe("flow store", () => {
  it("knows saved elements and their flows", () => {
    const s = useFlowStore.getState();
    expect(s.status).toBe("ready");
    expect(s.savedIds.has("child")).toBe(true);
    expect(s.flowsOf("child")).toHaveLength(1);
  });

  it("ignores a load for another owner", () => {
    useFlowStore.getState().loaded({ kind: "page", id: "other" }, { error: "x" });
    expect(useFlowStore.getState().status).toBe("ready");
  });

  it("carries flows to duplicated and pasted copies until the page is saved", () => {
    const source = tree().children[0]!;
    const copy = cloneWithNewIds(source, new Set(), false);
    const store = useFlowStore.getState();
    store.captureClipboard(source);
    store.copyFlows(pairNodeIds(source, copy), useFlowStore.getState().elementClipboard);
    const newChild = copy.children[0]!.id;
    expect(useFlowStore.getState().pending[newChild]?.[0]?.id).toBe("f1");

    const saved = tree();
    saved.children.push(copy);
    useFlowStore.getState().afterSave(saved);
    const after = useFlowStore.getState();
    expect(after.pending).toEqual({});
    expect(after.byNode[newChild]?.version).toBe(1);
    expect(after.savedIds.has(newChild)).toBe(true);
  });

  it("drops flows of elements removed by a save", () => {
    const saved = tree();
    saved.children = [];
    useFlowStore.getState().afterSave(saved);
    expect(useFlowStore.getState().byNode.child).toBeUndefined();
  });
});
