"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/menu";
import { insertFlowNode, newFlowNode, type FlowNodeKind, type FlowSlot } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";
import { useFlowDraft } from "./flow-draft";
import { NODE_KIND_LABELS } from "./node-menu";

const KINDS: FlowNodeKind[] = [
  "action",
  "condition",
  "loop",
  "parallel",
  "tryCatch",
  "block",
  "break",
  "continue"
];

/** Inserts a new node at a place in a list. */
export function addNode(slot: FlowSlot, index: number, kind: FlowNodeKind): void {
  const draft = useFlowDraft.getState();
  const node = newFlowNode(kind, kind === "block" ? (draft.blocks[0]?.id ?? "") : "");
  draft.setNodes(insertFlowNode(draft.nodes(), slot, index, node));
  draft.select(node.id);
}

/** The "+" between nodes: choose what to insert. Break and Continue only inside a loop. */
export function AddNodeMenu({
  slot,
  index,
  inLoop,
  label
}: {
  slot: FlowSlot;
  index: number;
  inLoop: boolean;
  label?: string;
}) {
  const hasBlocks = useFlowDraft((s) => s.blocks.length > 0);
  const disabledKeys = [...(hasBlocks ? [] : ["block"]), ...(inLoop ? [] : ["break", "continue"])];
  return (
    <Dropdown placement="bottom">
      <DropdownTrigger>
        {label ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-dashed border-default-300 px-3 py-1.5 text-sm text-muted hover:border-default-500 hover:text-foreground"
          >
            <Icon name="ph:plus" /> {label}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Insert a node here"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:border-default-500 hover:text-foreground"
          >
            <Icon name="ph:plus" width={12} height={12} />
          </button>
        )}
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Insert a node"
        disabledKeys={disabledKeys}
        onAction={(key) => addNode(slot, index, key as FlowNodeKind)}
      >
        {KINDS.map((kind) => (
          <DropdownItem
            key={kind}
            id={kind}
            description={
              kind === "block" && !hasBlocks
                ? "Create an Action Block first."
                : (kind === "break" || kind === "continue") && !inLoop
                  ? "Only inside a loop."
                  : undefined
            }
          >
            {NODE_KIND_LABELS[kind]}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
