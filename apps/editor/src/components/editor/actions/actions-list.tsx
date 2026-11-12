"use client";

import {
  getTrigger,
  ROOT_ELEMENT_TYPE,
  triggerLabel,
  triggerProblem,
  type ElementNode,
  type FlowOwner,
  type TriggerFlow
} from "@nextomic/schema";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { FlowCard, type CardCommand } from "./flow-card";
import { useFlowStore } from "./flow-store";
import { fetchFlows } from "./use-flow-sync";
import { useSaveFlows } from "./use-save-flows";

export function flowOwnerOf(node: ElementNode, kind: "page" | "template"): FlowOwner {
  return node.type === ROOT_ELEMENT_TYPE ? kind : "element";
}

// One shared empty list: a selector returning a fresh [] re-renders forever.
const NO_FLOWS: TriggerFlow[] = [];

/** The Actions tab: one card per trigger of the selected element. */
export function ActionsList({ node }: { node: ElementNode }) {
  const status = useFlowStore((s) => s.status);
  const error = useFlowStore((s) => s.error);
  const saved = useFlowStore((s) => s.savedIds.has(node.id));
  const flows = useFlowStore((s) => s.pending[node.id] ?? s.byNode[node.id]?.flows ?? NO_FLOWS);
  const clipboard = useFlowStore((s) => s.flowClipboard);
  const pageKind = useEditorStore((s) => s.page?.kind ?? "page");
  const toast = useEditorStore((s) => s.showToast);
  const { save, saving } = useSaveFlows();
  const owner = flowOwnerOf(node, pageKind);
  const open = (trigger: string | null) =>
    useFlowStore.getState().openEditor({ nodeId: node.id, trigger });

  if (status === "loading" || status === "idle") {
    return <p className="text-sm text-muted">Loading actions…</p>;
  }
  if (status === "error") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-danger">{error ?? "Could not load actions."}</p>
        <ActionButton size="sm" tone="ghost" onPress={() => void fetchFlows()}>
          Try again
        </ActionButton>
      </div>
    );
  }
  if (!saved) {
    return <p className="text-sm text-muted">Save the page to add actions to this new element.</p>;
  }

  const run = async (flow: TriggerFlow, command: CardCommand) => {
    const store = useFlowStore.getState();
    if (command === "copy" || command === "cut") store.setFlowClipboard(flow);
    if (command === "copy") return toast("Action flow copied");
    const next =
      command === "toggle"
        ? flows.map((f) => (f.id === flow.id ? { ...f, disabled: !f.disabled } : f))
        : flows.filter((f) => f.id !== flow.id);
    if ((await save(node.id, next)) && command !== "toggle") {
      toast(command === "cut" ? "Action flow cut" : "Action flow deleted");
    }
  };

  const paste = async () => {
    if (!clipboard) return;
    const trigger = getTrigger(clipboard.trigger);
    const label = trigger ? triggerLabel(trigger, owner) : clipboard.trigger;
    const problem = triggerProblem(clipboard.trigger, owner, node.type);
    if (problem) return toast(problem);
    if (flows.some((f) => f.trigger === clipboard.trigger)) {
      return toast(`This element already has a ${label} flow.`);
    }
    const copy = { ...structuredClone(clipboard), id: crypto.randomUUID() };
    if (await save(node.id, [...flows, copy])) toast("Action flow pasted");
  };

  return (
    <div className="flex flex-col gap-3">
      {flows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <Icon name="ph:lightning" width={22} height={22} className="text-subtle" />
          <p className="text-sm text-muted">No actions on this element yet.</p>
          <ActionButton size="sm" onPress={() => open(null)}>
            Add action
          </ActionButton>
        </div>
      ) : (
        <ul aria-label="Action flows" className="flex flex-col gap-2">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              owner={owner}
              busy={saving}
              onOpen={() => open(flow.trigger)}
              onCommand={(command) => void run(flow, command)}
            />
          ))}
        </ul>
      )}
      {clipboard ? (
        <ActionButton
          size="sm"
          tone="ghost"
          isDisabled={saving}
          startContent={<Icon name="ph:clipboard" />}
          onPress={() => void paste()}
        >
          Paste action flow
        </ActionButton>
      ) : null}
    </div>
  );
}
