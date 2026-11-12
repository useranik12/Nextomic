"use client";

import {
  defaultParams,
  findFlowNode,
  getAction,
  getTrigger,
  replaceFlowNode,
  type FlowNode
} from "@nextomic/schema";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { BoltInput } from "../../right-panel/bolt-input";
import { ActionPicker } from "./action-picker";
import { ContainerSettings } from "./container-settings";
import { useFlowDraft } from "./flow-draft";
import { NODE_KIND_LABELS, NodeMenu } from "./node-menu";
import { ParamFields } from "./param-field";

type Of<K extends FlowNode["kind"]> = Extract<FlowNode, { kind: K }>;

function OutputName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <FormInput
      compact
      label="Output variable name"
      value={value}
      onValueChange={onChange}
      description="Later nodes read the result by this name (bolt: Actions). Leave empty to drop it."
    />
  );
}

function ActionSettings({ node, update }: { node: Of<"action">; update: (n: FlowNode) => void }) {
  const blocks = useFlowDraft((s) => s.blocks);
  const action = getAction(node.type);
  if (!action) {
    return (
      <ActionPicker
        blocks={blocks}
        onPick={(type) => {
          const picked = getAction(type);
          update({ ...node, type, params: picked ? defaultParams(picked.fields) : {} });
        }}
        onPickBlock={(blockId) => update({ id: node.id, kind: "block", blockId, params: {} })}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold">{action.label}</p>
          <p className="text-xs text-muted">{action.description}</p>
        </div>
        <ActionButton
          size="sm"
          tone="ghost"
          onPress={() => update({ ...node, type: "", params: {} })}
        >
          Change
        </ActionButton>
      </div>
      <ParamFields
        fields={action.fields}
        params={node.params}
        onChange={(params) => update({ ...node, params })}
      />
      {action.output ? (
        <OutputName
          value={node.outputName ?? ""}
          onChange={(v) => update({ ...node, outputName: v || undefined })}
        />
      ) : null}
    </div>
  );
}

function BlockSettings({ node, update }: { node: Of<"block">; update: (n: FlowNode) => void }) {
  const blocks = useFlowDraft((s) => s.blocks);
  const block = blocks.find((b) => b.id === node.blockId);
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        compact
        label="Action Block *"
        value={node.blockId}
        options={blocks.map((b) => ({ value: b.id, label: b.name }))}
        onValueChange={(blockId) => update({ ...node, blockId, params: {} })}
        description={block?.description || undefined}
      />
      {block?.params.map((param) => (
        <BoltInput
          key={param.id}
          label={`${param.name}${param.required ? " *" : ""}`}
          value={typeof node.params[param.id] === "string" ? (node.params[param.id] as string) : ""}
          onValueChange={(v) => update({ ...node, params: { ...node.params, [param.id]: v } })}
        />
      ))}
      {block?.returns ? (
        <OutputName
          value={node.outputName ?? ""}
          onChange={(v) => update({ ...node, outputName: v || undefined })}
        />
      ) : null}
    </div>
  );
}

/** Right column: the selected node's settings, or the trigger's settings. */
export function DefinePanel() {
  const selectedId = useFlowDraft((s) => s.selectedId);
  const nodes = useFlowDraft((s) => s.nodes());
  const flow = useFlowDraft((s) => s.flows.find((f) => f.trigger === s.trigger));
  const setNodes = useFlowDraft((s) => s.setNodes);
  const setTriggerSettings = useFlowDraft((s) => s.setTriggerSettings);
  const found = selectedId ? findFlowNode(nodes, selectedId) : null;
  const update = (next: FlowNode) => setNodes(replaceFlowNode(nodes, next));

  if (!found) {
    const trigger = flow ? getTrigger(flow.trigger) : undefined;
    if (flow && trigger?.fields?.length) {
      return (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">{trigger.label} settings</h3>
          <ParamFields
            fields={trigger.fields}
            params={flow.settings}
            onChange={setTriggerSettings}
          />
        </div>
      );
    }
    return <p className="text-sm text-muted">Select a node to define it.</p>;
  }
  const { node } = found;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <FormInput
          compact
          label="Node name"
          placeholder={NODE_KIND_LABELS[node.kind]}
          value={node.name ?? ""}
          onValueChange={(name) => update({ ...node, name: name || undefined })}
          className="flex-1"
        />
        <NodeMenu nodeId={node.id} />
      </div>
      {node.disabled ? (
        <p className="rounded-lg bg-warning-50 px-2 py-1 text-xs text-warning-700">
          This node is disabled and is skipped.
        </p>
      ) : null}
      {node.kind === "action" ? (
        <ActionSettings node={node} update={update} />
      ) : node.kind === "block" ? (
        <BlockSettings node={node} update={update} />
      ) : (
        <ContainerSettings node={node} update={update} />
      )}
    </div>
  );
}
