import type { RunLogEntry } from "@nextomic/runtime";
import { findFlowNode, themeChoices, type FlowNode } from "@nextomic/schema";
import { create } from "zustand";
import { testContextAction } from "@/app/(builder)/editor/[id]/action-flow-actions";
import { canTest, onTestEvent, sendTest } from "@/components/editor/canvas/test-bridge";
import { useEditorStore } from "@/components/editor/store/editor-store";
import { useFlowDraft } from "./flow-draft";

// The flow editor's Test (docs/ui-reference.md 4.8): runs the open trigger, or one node, on the
// canvas with the unsaved draft. While it runs the editor steps aside so the canvas is visible,
// and a panel lists each step.

export type TestStatus = "idle" | "preparing" | "running" | "done";

interface FlowTestState {
  /** The editor is hidden and the test panel shows over the canvas. */
  active: boolean;
  status: TestStatus;
  runId: string;
  /** What runs: the whole trigger, or one node's label. */
  scope: string;
  entries: RunLogEntry[];
  error: string | null;
  /** The node run alone, if the test runs one node. */
  nodeId: string | undefined;
  start: (nodeId?: string) => Promise<void>;
  /** Runs the same test again. */
  again: () => Promise<void>;
  /** Ends the test, drops the state it changed and returns to the editor. */
  finish: () => void;
}

const nextRunId = () => crypto.randomUUID();

export const useFlowTest = create<FlowTestState>((set, get) => ({
  active: false,
  status: "idle",
  runId: "",
  scope: "",
  entries: [],
  error: null,
  nodeId: undefined,
  again: () => get().start(get().nodeId),
  start: async (nodeId) => {
    const draft = useFlowDraft.getState();
    const target = draft.target;
    if (target?.mode !== "flows") return;
    const all = draft.nodes();
    const one = nodeId ? findFlowNode(all, nodeId)?.node : undefined;
    const nodes: FlowNode[] = one ? [one] : all;
    const runId = nextRunId();
    set({
      active: true,
      status: "preparing",
      runId,
      nodeId: one ? nodeId : undefined,
      scope: one ? "One node" : "Whole trigger",
      entries: [],
      error: null
    });
    if (!canTest()) {
      set({ status: "done", error: "Open the page canvas to run a test." });
      return;
    }
    const { projectId, project } = useEditorStore.getState();
    const context = await testContextAction(projectId);
    if (get().runId !== runId) return;
    if (context.error !== null) {
      set({ status: "done", error: context.error });
      return;
    }
    set({ status: "running" });
    sendTest({
      type: "test-run",
      runId,
      elementId: target.nodeId,
      nodes,
      blocks: draft.blocks,
      appState: project.appState,
      routes: context.data.routes,
      themes: themeChoices(project.themes),
      overlays: context.data.overlays
    });
  },
  finish: () => {
    sendTest({ type: "test-stop" });
    set({ active: false, status: "idle", runId: "", entries: [], error: null });
  }
}));

// Steps and the end of the run arrive from the canvas.
onTestEvent((event) => {
  const state = useFlowTest.getState();
  if (event.runId !== state.runId) return;
  if (event.type === "log") useFlowTest.setState({ entries: [...state.entries, event.entry] });
  else useFlowTest.setState({ status: "done", error: event.error });
});
