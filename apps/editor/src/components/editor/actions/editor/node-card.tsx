"use client";

import { getAction, moveFlowNode, type FlowNode } from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useFlowDraft } from "./flow-draft";
import { NODE_KIND_LABELS, NodeMenu } from "./node-menu";

const clip = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

/** Title and one-line summary of a node. */
export function describeNode(
  node: FlowNode,
  blockName: (id: string) => string | undefined
): { title: string; summary: string } {
  if (node.kind === "action") {
    const action = getAction(node.type);
    if (!action) return { title: node.name ?? "Not defined", summary: "Choose an action" };
    const summary = (action.summary ?? [])
      .map((key) => node.params[key])
      .filter((v): v is string => typeof v === "string" && v !== "")
      .join(" · ");
    return { title: node.name ?? action.label, summary: clip(summary || action.description) };
  }
  if (node.kind === "block") {
    return {
      title: node.name ?? blockName(node.blockId) ?? "Missing Action Block",
      summary: "Action Block"
    };
  }
  const summary =
    node.kind === "condition"
      ? `${node.branches.length} ${node.branches.length === 1 ? "branch" : "branches"}${node.else ? " + else" : ""}`
      : node.kind === "loop"
        ? node.mode === "forEach"
          ? clip(`For each ${node.itemName} in ${node.list || "…"}`)
          : "While a condition holds"
        : node.kind === "parallel"
          ? `${node.lanes.length} lanes`
          : node.kind === "tryCatch"
            ? `Errors as ${node.errorName}`
            : "";
  return { title: node.name ?? NODE_KIND_LABELS[node.kind], summary };
}

export function NodeCard({
  node,
  number,
  hasError,
  canUp,
  canDown
}: {
  node: FlowNode;
  number: number;
  hasError: boolean;
  canUp: boolean;
  canDown: boolean;
}) {
  const selected = useFlowDraft((s) => s.selectedId === node.id);
  const blocks = useFlowDraft((s) => s.blocks);
  const [menuOpen, setMenuOpen] = useState(false);
  const { title, summary } = describeNode(node, (id) => blocks.find((b) => b.id === id)?.name);
  const undefinedAction = node.kind === "action" && !getAction(node.type);
  const move = (step: -1 | 1) => {
    const draft = useFlowDraft.getState();
    draft.setNodes(moveFlowNode(draft.nodes(), node.id, step));
  };
  return (
    <div
      data-flow-node
      onContextMenu={(e) => {
        e.preventDefault();
        useFlowDraft.getState().select(node.id);
        setMenuOpen(true);
      }}
      className={
        "flex w-72 items-center gap-1 rounded-medium border bg-content1 pr-1 transition-colors duration-300 " +
        (hasError
          ? "border-danger "
          : selected
            ? "border-primary "
            : "border-divider hover:border-default-400 ") +
        (node.disabled ? "opacity-50" : "")
      }
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => useFlowDraft.getState().select(node.id)}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="text-tiny uppercase tracking-wide text-default-500">Action {number}</span>
        <span
          className={`truncate text-small font-semibold ${undefinedAction ? "text-danger" : "text-foreground"}`}
        >
          {title}
        </span>
        {summary ? (
          <span className="w-full truncate text-tiny text-default-500">{summary}</span>
        ) : null}
      </button>
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={!canUp}
          onClick={() => move(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-default-500 hover:bg-default-100 disabled:opacity-30"
        >
          <Icon name="ph:caret-up" width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={!canDown}
          onClick={() => move(1)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-default-500 hover:bg-default-100 disabled:opacity-30"
        >
          <Icon name="ph:caret-down" width={14} height={14} />
        </button>
      </div>
      <NodeMenu nodeId={node.id} isOpen={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
