"use client";

import type { ActionBlock, FlowNode, FlowOwner, Params, TriggerFlow } from "@nextomic/schema";
import { create } from "zustand";

// The flow editor modal's working copy. Nothing reaches the server until Save.

export type DraftTarget =
  | { mode: "flows"; nodeId: string; owner: FlowOwner; elementType: string; elementName: string }
  | { mode: "block"; blockId: string | null };

interface Snapshot {
  flows: TriggerFlow[];
  block: ActionBlock | null;
}

interface DraftState extends Snapshot {
  target: DraftTarget | null;
  trigger: string | null;
  blockVersion: number | null;
  /** The project's blocks (for block calls and checks). */
  blocks: ActionBlock[];
  selectedId: string | null;
  dirty: boolean;
  clip: FlowNode | null;
  past: Snapshot[];
  future: Snapshot[];
  open: (target: DraftTarget, init: Partial<DraftState>) => void;
  close: () => void;
  /** The node list being edited: the open trigger's flow, or the block. */
  nodes: () => FlowNode[];
  setNodes: (nodes: FlowNode[]) => void;
  setFlows: (flows: TriggerFlow[]) => void;
  setBlock: (block: ActionBlock) => void;
  setTriggerSettings: (settings: Params) => void;
  selectTrigger: (trigger: string | null) => void;
  select: (id: string | null) => void;
  setClip: (node: FlowNode | null) => void;
  markSaved: (blockVersion?: number) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY = 100;
const NO_NODES: FlowNode[] = [];

export const useFlowDraft = create<DraftState>()((set, get) => {
  /** Records the current state for undo, then applies the change. */
  const change = (next: Partial<Snapshot>) => {
    const { flows, block, past } = get();
    set({ ...next, past: [...past, { flows, block }].slice(-HISTORY), future: [], dirty: true });
  };
  return {
    target: null,
    flows: [],
    block: null,
    trigger: null,
    blockVersion: null,
    blocks: [],
    selectedId: null,
    dirty: false,
    clip: null,
    past: [],
    future: [],

    open: (target, init) =>
      set({
        flows: [],
        block: null,
        trigger: null,
        blockVersion: null,
        selectedId: null,
        dirty: false,
        past: [],
        future: [],
        ...init,
        target
      }),
    close: () => set({ target: null, past: [], future: [] }),

    nodes: () => {
      const { target, flows, trigger, block } = get();
      if (target?.mode === "block") return block?.nodes ?? NO_NODES;
      return flows.find((f) => f.trigger === trigger)?.nodes ?? NO_NODES;
    },

    setNodes: (nodes) => {
      const { target, flows, trigger, block } = get();
      if (target?.mode === "block") {
        if (block) change({ block: { ...block, nodes } });
        return;
      }
      change({ flows: flows.map((f) => (f.trigger === trigger ? { ...f, nodes } : f)) });
    },
    setFlows: (flows) => change({ flows }),
    setBlock: (block) => change({ block }),
    setTriggerSettings: (settings) => {
      const { flows, trigger } = get();
      change({ flows: flows.map((f) => (f.trigger === trigger ? { ...f, settings } : f)) });
    },
    selectTrigger: (trigger) => set({ trigger, selectedId: null }),
    select: (selectedId) => set({ selectedId }),
    setClip: (clip) => set({ clip: clip ? structuredClone(clip) : null }),
    markSaved: (blockVersion) =>
      set((s) => ({ dirty: false, blockVersion: blockVersion ?? s.blockVersion })),

    undo: () => {
      const { past, future, flows, block } = get();
      const last = past.at(-1);
      if (!last) return;
      set({ ...last, past: past.slice(0, -1), future: [{ flows, block }, ...future], dirty: true });
    },
    redo: () => {
      const { past, future, flows, block } = get();
      const next = future[0];
      if (!next) return;
      set({ ...next, past: [...past, { flows, block }], future: future.slice(1), dirty: true });
    }
  };
});
