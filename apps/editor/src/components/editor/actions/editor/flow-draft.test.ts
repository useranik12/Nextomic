import { newFlowNode } from "@nextomic/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { useFlowDraft } from "./flow-draft";

const flow = (trigger: string) => ({ id: trigger, trigger, settings: {}, nodes: [] });

describe("flow draft", () => {
  beforeEach(() => {
    useFlowDraft.getState().open(
      {
        mode: "flows",
        nodeId: "n1",
        owner: "element",
        elementType: "button",
        elementName: "Button"
      },
      { flows: [flow("click"), flow("hover")], trigger: "click" }
    );
  });

  it("edits only the open trigger's nodes", () => {
    const node = newFlowNode("action");
    useFlowDraft.getState().setNodes([node]);
    const { flows, dirty } = useFlowDraft.getState();
    expect(flows[0]?.nodes).toEqual([node]);
    expect(flows[1]?.nodes).toEqual([]);
    expect(dirty).toBe(true);
  });

  it("returns the same empty list while nothing changes", () => {
    useFlowDraft.getState().selectTrigger(null);
    expect(useFlowDraft.getState().nodes()).toBe(useFlowDraft.getState().nodes());
  });

  it("undoes and redoes changes", () => {
    const draft = useFlowDraft.getState();
    draft.setNodes([newFlowNode("action")]);
    draft.undo();
    expect(useFlowDraft.getState().nodes()).toHaveLength(0);
    useFlowDraft.getState().redo();
    expect(useFlowDraft.getState().nodes()).toHaveLength(1);
  });

  it("clears the dirty mark on save", () => {
    useFlowDraft.getState().setNodes([newFlowNode("action")]);
    useFlowDraft.getState().markSaved();
    expect(useFlowDraft.getState().dirty).toBe(false);
  });
});
