"use client";

import {
  slotLists,
  TOP_SLOT,
  walkFlow,
  type FlowNode,
  type FlowNodeKind,
  type FlowSlot
} from "@nextomic/schema";
import { Fragment, useMemo } from "react";
import { ActionButton } from "@/components/ui/controls";
import { AddNodeMenu, addNode } from "./add-node-menu";
import { useFlowDraft } from "./flow-draft";
import { NodeCard } from "./node-card";
import { NODE_KIND_LABELS } from "./node-menu";
import { TriggerPicker } from "./trigger-picker";

interface ListContext {
  numbers: ReadonlyMap<string, number>;
  errors: ReadonlySet<string>;
}

const Connector = () => <div aria-hidden className="h-3 w-px bg-divider" />;

function NodeList({
  nodes,
  slot,
  inLoop,
  ctx
}: {
  nodes: readonly FlowNode[];
  slot: FlowSlot;
  inLoop: boolean;
  ctx: ListContext;
}) {
  if (nodes.length === 0) {
    return <AddNodeMenu slot={slot} index={0} inLoop={inLoop} label="Add" />;
  }
  return (
    <div className="flex flex-col items-center">
      <AddNodeMenu slot={slot} index={0} inLoop={inLoop} />
      {nodes.map((node, i) => (
        <Fragment key={node.id}>
          <Connector />
          <NodeBlock
            node={node}
            inLoop={inLoop}
            ctx={ctx}
            canUp={i > 0}
            canDown={i < nodes.length - 1}
          />
          <Connector />
          <AddNodeMenu slot={slot} index={i + 1} inLoop={inLoop} />
        </Fragment>
      ))}
    </div>
  );
}

function NodeBlock({
  node,
  inLoop,
  ctx,
  canUp,
  canDown
}: {
  node: FlowNode;
  inLoop: boolean;
  ctx: ListContext;
  canUp: boolean;
  canDown: boolean;
}) {
  const lists = slotLists(node);
  const card = (
    <NodeCard
      node={node}
      number={ctx.numbers.get(node.id) ?? 0}
      hasError={ctx.errors.has(node.id)}
      canUp={canUp}
      canDown={canDown}
    />
  );
  if (lists.length === 0) return card;
  const childInLoop = inLoop || node.kind === "loop";
  // Branches and lanes sit side by side; a loop body sits below its header.
  const row = node.kind === "condition" || node.kind === "parallel" || node.kind === "tryCatch";
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-large border border-dashed border-default-300 p-3 ${node.disabled ? "opacity-60" : ""}`}
    >
      {card}
      <div className={row ? "flex items-start gap-4" : "flex flex-col items-center"}>
        {lists.map((list) => (
          <section
            key={list.list}
            aria-label={list.label}
            className="flex flex-col items-center gap-1 rounded-medium bg-default-50 p-2"
          >
            <h4 className="text-tiny font-semibold uppercase tracking-wide text-default-500">
              {list.label}
            </h4>
            <NodeList
              nodes={list.nodes}
              slot={{ parent: node.id, list: list.list }}
              inLoop={childInLoop}
              ctx={ctx}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

const START_KINDS: FlowNodeKind[] = [
  "action",
  "condition",
  "loop",
  "parallel",
  "tryCatch",
  "block"
];

/** Center column: the open trigger's nodes, top to bottom. */
export function FlowCanvas({ errors }: { errors: ReadonlySet<string> }) {
  const mode = useFlowDraft((s) => s.target?.mode);
  const trigger = useFlowDraft((s) => s.trigger);
  const nodes = useFlowDraft((s) => s.nodes());
  const hasBlocks = useFlowDraft((s) => s.blocks.length > 0);
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    walkFlow(nodes, (node) => map.set(node.id, map.size + 1));
    return map;
  }, [nodes]);

  if (mode === "flows" && !trigger) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-medium font-semibold">Select Action Trigger</p>
        <TriggerPicker variant="large" />
      </div>
    );
  }
  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-medium font-semibold">No Actions Created</p>
        <div className="flex max-w-md flex-wrap justify-center gap-2">
          {START_KINDS.map((kind) => (
            <ActionButton
              key={kind}
              size="sm"
              tone={kind === "action" ? "primary" : "ghost"}
              isDisabled={kind === "block" && !hasBlocks}
              onPress={() => addNode(TOP_SLOT, 0, kind)}
            >
              {kind === "action" ? "Add Action" : NODE_KIND_LABELS[kind]}
            </ActionButton>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-full justify-center p-6">
      <NodeList nodes={nodes} slot={TOP_SLOT} inLoop={false} ctx={{ numbers, errors }} />
    </div>
  );
}
