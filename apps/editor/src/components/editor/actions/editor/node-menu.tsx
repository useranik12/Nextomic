"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import {
  findFlowNode,
  insertFlowNode,
  removeFlowNode,
  replaceFlowNode,
  withFreshIds,
  type FlowNodeKind
} from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";
import { useFlowDraft } from "./flow-draft";

export const NODE_KIND_LABELS: Record<FlowNodeKind, string> = {
  action: "Action",
  condition: "Conditional Action",
  loop: "Loop",
  break: "Break",
  continue: "Continue",
  parallel: "Parallel Action",
  tryCatch: "Try/Catch",
  block: "Action Block"
};

type Command = "test" | "copy" | "paste" | "cut" | "toggle" | "duplicate" | "delete";

function runCommand(nodeId: string, command: Command): void {
  const draft = useFlowDraft.getState();
  const nodes = draft.nodes();
  const found = findFlowNode(nodes, nodeId);
  if (!found) return;
  const { node, slot, index } = found;
  switch (command) {
    case "copy":
      draft.setClip(node);
      return;
    case "cut":
      draft.setClip(node);
      draft.setNodes(removeFlowNode(nodes, nodeId));
      draft.select(null);
      return;
    case "paste": {
      if (!draft.clip) return;
      const copy = withFreshIds(draft.clip);
      draft.setNodes(insertFlowNode(nodes, slot, index + 1, copy));
      draft.select(copy.id);
      return;
    }
    case "duplicate": {
      const copy = withFreshIds(node);
      draft.setNodes(insertFlowNode(nodes, slot, index + 1, copy));
      draft.select(copy.id);
      return;
    }
    case "toggle":
      draft.setNodes(replaceFlowNode(nodes, { ...node, disabled: !node.disabled || undefined }));
      return;
    case "delete":
      draft.setNodes(removeFlowNode(nodes, nodeId));
      draft.select(null);
      return;
    case "test":
      return;
  }
}

/** The node's kebab menu; also opened by right-clicking the node (controlled `isOpen`). */
export function NodeMenu({
  nodeId,
  isOpen,
  onOpenChange
}: {
  nodeId: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const hasClip = useFlowDraft((s) => s.clip !== null);
  const disabled = useFlowDraft((s) => findFlowNode(s.nodes(), nodeId)?.node.disabled ?? false);
  const disabledKeys = ["test", ...(hasClip ? [] : ["paste"])];
  return (
    <Dropdown
      placement="bottom-end"
      {...(isOpen === undefined ? {} : { isOpen })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <DropdownTrigger>
        <button
          type="button"
          aria-label="Node options"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-foreground"
        >
          <Icon name="ph:dots-three-vertical" width={18} height={18} />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Node options"
        disabledKeys={disabledKeys}
        onAction={(key) => runCommand(nodeId, key as Command)}
      >
        <DropdownItem
          key="test"
          startContent={<Icon name="ph:play" />}
          description="Test runs arrive with the runtime (Phase 5b)."
        >
          Test node action
        </DropdownItem>
        <DropdownItem key="copy" startContent={<Icon name="ph:copy" />}>
          Copy
        </DropdownItem>
        <DropdownItem key="paste" startContent={<Icon name="ph:clipboard" />}>
          Paste after
        </DropdownItem>
        <DropdownItem key="cut" startContent={<Icon name="ph:scissors" />}>
          Cut
        </DropdownItem>
        <DropdownItem key="duplicate" startContent={<Icon name="ph:files" />}>
          Duplicate
        </DropdownItem>
        <DropdownItem
          key="toggle"
          startContent={disabled ? <Icon name="ph:check-circle" /> : <Icon name="ph:prohibit" />}
        >
          {disabled ? "Enable" : "Disable"}
        </DropdownItem>
        <DropdownItem
          key="delete"
          className="text-danger"
          color="danger"
          startContent={<Icon name="ph:trash" />}
        >
          Delete
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
