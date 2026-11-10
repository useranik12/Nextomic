"use client";

import {
  compactFlows,
  walkElements,
  type ElementNode,
  type FlowOwnerKind,
  type FlowsByNode,
  type TriggerFlow
} from "@nextomic/schema";
import { create } from "zustand";

// Action flows of the open page or template. Flows are saved apart from the page draft (the flow
// editor saves on its own); flows of pasted or duplicated elements wait in `pending` and go out
// with the next page save, because those elements are not in the saved tree yet.

export interface FlowOwnerRef {
  kind: FlowOwnerKind;
  id: string;
}

export interface NodeFlows {
  flows: TriggerFlow[];
  /** Server version; null when the element has no saved record. */
  version: number | null;
}

/** What the flow editor modal shows: one element's flows, opened at a trigger (or none yet). */
export interface FlowEditorRequest {
  nodeId: string;
  trigger: string | null;
}

interface FlowState {
  projectId: string | null;
  owner: FlowOwnerRef | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  byNode: Record<string, NodeFlows>;
  /** Element ids in the last saved tree: only those can save flows. */
  savedIds: ReadonlySet<string>;
  pending: FlowsByNode;
  /** Flows of the element subtree on the editor clipboard, by the copied (old) ids. */
  elementClipboard: FlowsByNode;
  /** One trigger flow copied or cut from a card. */
  flowClipboard: TriggerFlow | null;
  editor: FlowEditorRequest | null;
  /** The Action Block open in the editor: its id, "new", or none. */
  blockEditor: string | null;
  /** Starts showing a page or template; its flows arrive with `loaded` (see use-flow-sync). */
  begin: (projectId: string, owner: FlowOwnerRef, savedTree: ElementNode) => void;
  loading: () => void;
  loaded: (
    owner: FlowOwnerRef,
    result: { byNode: Record<string, NodeFlows> } | { error: string }
  ) => void;
  setNodeFlows: (nodeId: string, value: NodeFlows) => void;
  /** After a page save: the tree is now saved and pending flows are written. */
  afterSave: (tree: ElementNode) => void;
  /** Flows of an element (saved or pending). */
  flowsOf: (nodeId: string) => TriggerFlow[];
  copyFlows: (pairs: ReadonlyMap<string, string>, from?: FlowsByNode) => void;
  captureClipboard: (root: ElementNode) => void;
  setFlowClipboard: (flow: TriggerFlow | null) => void;
  openEditor: (request: FlowEditorRequest) => void;
  closeEditor: () => void;
  openBlock: (id: string | null) => void;
}

const idsOf = (tree: ElementNode): Set<string> => {
  const ids = new Set<string>();
  walkElements(tree, (node) => ids.add(node.id));
  return ids;
};

const fresh = (flows: TriggerFlow[]): TriggerFlow[] => structuredClone(flows);

export const useFlowStore = create<FlowState>()((set, get) => ({
  projectId: null,
  owner: null,
  status: "idle",
  error: null,
  byNode: {},
  savedIds: new Set(),
  pending: {},
  elementClipboard: {},
  flowClipboard: null,
  editor: null,
  blockEditor: null,

  begin: (projectId, owner, savedTree) =>
    set({ projectId, owner, byNode: {}, pending: {}, editor: null, savedIds: idsOf(savedTree) }),

  loading: () => set({ status: "loading", error: null }),

  loaded: (owner, result) => {
    // A load for another page or template started meanwhile: it wins.
    if (get().owner !== owner) return;
    if ("error" in result) set({ status: "error", error: result.error });
    else set({ status: "ready", byNode: result.byNode });
  },

  setNodeFlows: (nodeId, value) => set((s) => ({ byNode: { ...s.byNode, [nodeId]: value } })),

  afterSave: (tree) => {
    const ids = idsOf(tree);
    const { byNode, pending } = get();
    const next: Record<string, NodeFlows> = {};
    for (const [nodeId, value] of Object.entries(byNode)) if (ids.has(nodeId)) next[nodeId] = value;
    // The server writes pending flows only for elements that had none (version 1).
    for (const [nodeId, flows] of Object.entries(pending)) {
      if (ids.has(nodeId) && !next[nodeId]) next[nodeId] = { flows, version: 1 };
    }
    set({ byNode: next, pending: {}, savedIds: ids });
  },

  flowsOf: (nodeId) => get().pending[nodeId] ?? get().byNode[nodeId]?.flows ?? [],

  copyFlows: (pairs, from) => {
    const added: FlowsByNode = {};
    for (const [oldId, newId] of pairs) {
      const flows = from ? (from[oldId] ?? []) : get().flowsOf(oldId);
      if (flows.length > 0) added[newId] = fresh(flows);
    }
    if (Object.keys(added).length > 0) set((s) => ({ pending: { ...s.pending, ...added } }));
  },

  captureClipboard: (root) => {
    const copied: FlowsByNode = {};
    walkElements(root, (node) => {
      copied[node.id] = fresh(get().flowsOf(node.id));
    });
    set({ elementClipboard: compactFlows(copied) });
  },

  setFlowClipboard: (flow) => set({ flowClipboard: flow ? structuredClone(flow) : null }),
  openEditor: (request) => set({ editor: request }),
  closeEditor: () => set({ editor: null }),
  openBlock: (id) => set({ blockEditor: id })
}));
