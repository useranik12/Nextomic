import { describe, expect, it } from "vitest";
import type { ElementNode, FlowsByNode } from "@nextomic/schema";
import { flowsInTree } from "./action-flows";

const node = (id: string, children: ElementNode[] = []) =>
  ({ id, type: "container", children }) as unknown as ElementNode;

describe("flowsInTree", () => {
  const tree = node("root", [node("a"), node("b")]);
  const flows = { a: [], ghost: [] } as unknown as FlowsByNode;

  it("drops the flows of elements that are not in the tree", () => {
    expect(Object.keys(flowsInTree(tree, flows) ?? {})).toEqual(["a"]);
  });

  it("passes an absent map through", () => {
    expect(flowsInTree(tree, undefined)).toBeUndefined();
  });
});
