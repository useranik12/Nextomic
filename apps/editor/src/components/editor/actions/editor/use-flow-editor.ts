"use client";

import {
  findNode,
  flowIssues,
  nodesIssues,
  recursiveBlocks,
  walkFlow,
  type ActionBlock,
  type FlowIssue
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBlocksAction,
  saveBlockAction,
  testContextAction
} from "@/app/(builder)/editor/[id]/action-flow-actions";
import { useQuerySourcesStore } from "../../query/use-query-sources";
import { useEditorStore } from "../../store/editor-store";
import { flowOwnerOf } from "../actions-list";
import { useFlowStore } from "../flow-store";
import { useSaveFlows } from "../use-save-flows";
import { useFlowDraft } from "./flow-draft";

export interface EditorIssue extends FlowIssue {
  /** The trigger whose flow has the issue; null in block mode. */
  trigger: string | null;
}

type Load = { status: "closed" | "loading" | "ready" } | { status: "error"; error: string };

const newBlock = (): ActionBlock => ({
  id: crypto.randomUUID(),
  name: "New block",
  description: "",
  params: [],
  nodes: []
});

/** Loads the draft when the flow store asks for the editor, and closes it again. */
function useOpenDraft(): Load {
  const request = useFlowStore((s) => s.editor);
  const blockRequest = useFlowStore((s) => s.blockEditor);
  const projectId = useEditorStore((s) => s.projectId);
  const [load, setLoad] = useState<Load>({ status: "closed" });

  useEffect(() => {
    if (!projectId || (!request && !blockRequest)) {
      useFlowDraft.getState().close();
      setLoad({ status: "closed" });
      return;
    }
    let live = true;
    setLoad({ status: "loading" });
    void listBlocksAction(projectId).then((result) => {
      if (!live) return;
      if (result.error !== null) return setLoad({ status: "error", error: result.error });
      const blocks = result.data.map((b) => b.block);
      const draft = useFlowDraft.getState();
      if (request) {
        const { doc, page } = useEditorStore.getState();
        const node = doc ? findNode(doc.tree, request.nodeId)?.node : null;
        if (!node) return setLoad({ status: "error", error: "This element no longer exists." });
        draft.open(
          {
            mode: "flows",
            nodeId: node.id,
            owner: flowOwnerOf(node, page?.kind ?? "page"),
            elementType: node.type,
            elementName: node.name ?? node.type
          },
          {
            flows: structuredClone(useFlowStore.getState().flowsOf(node.id)),
            trigger: request.trigger,
            blocks
          }
        );
      } else {
        const stored = result.data.find((b) => b.block.id === blockRequest);
        if (!stored && blockRequest !== "new") {
          return setLoad({ status: "error", error: "This Action Block was deleted." });
        }
        draft.open(
          { mode: "block", blockId: stored?.block.id ?? null },
          {
            block: structuredClone(stored?.block ?? newBlock()),
            blockVersion: stored?.version ?? null,
            blocks
          }
        );
      }
      setLoad({ status: "ready" });
    });
    return () => {
      live = false;
    };
  }, [projectId, request, blockRequest]);

  return load;
}

const NO_TOAST =
  "No toast template applies: create one in Templates and set it to Published, or Show Toast fails.";

/** Whether a toast template is set to Published (null while unknown); checked when the editor opens. */
function useHasToast(open: boolean): boolean | null {
  const projectId = useEditorStore((s) => s.projectId);
  const [hasToast, setHasToast] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open || !projectId) return;
    let live = true;
    void testContextAction(projectId).then((result) => {
      if (live) setHasToast(result.error === null ? result.data.toast !== null : null);
    });
    return () => {
      live = false;
    };
  }, [open, projectId]);
  return hasToast;
}

/** Every problem of the draft, each tagged with its trigger. */
function useIssues(): EditorIssue[] {
  const target = useFlowDraft((s) => s.target);
  const flows = useFlowDraft((s) => s.flows);
  const block = useFlowDraft((s) => s.block);
  const blocks = useFlowDraft((s) => s.blocks);
  const supabase = useQuerySourcesStore((s) => s.data?.supabase?.structure ?? null);
  const hasToast = useHasToast(target !== null);
  return useMemo(() => {
    if (target?.mode === "flows") {
      const ctx = { owner: target.owner, elementType: target.elementType, blocks, supabase };
      return flows.flatMap((flow) => {
        const issues: EditorIssue[] = flowIssues(flow, ctx).map((i) => ({
          ...i,
          trigger: flow.trigger
        }));
        if (hasToast === false) {
          walkFlow(flow.nodes, (n) => {
            if (n.kind === "action" && n.type === "toast")
              issues.push({
                nodeId: n.id,
                message: NO_TOAST,
                severity: "warning",
                trigger: flow.trigger
              });
          });
        }
        return issues;
      });
    }
    if (!block) return [];
    const all = [...blocks.filter((b) => b.id !== block.id), block];
    const own: FlowIssue[] = [];
    if (!block.name.trim())
      own.push({ nodeId: null, message: "Name the block.", severity: "error" });
    if (recursiveBlocks(all).has(block.id)) {
      own.push({
        nodeId: null,
        message: "This block calls itself, directly or through another block.",
        severity: "error"
      });
    }
    return [...own, ...nodesIssues(block.nodes, all, supabase)].map((i) => ({
      ...i,
      trigger: null
    }));
  }, [target, flows, block, blocks, supabase, hasToast]);
}

/** Saves the draft: an element's flows, or one Action Block. Returns true when saved. */
function useSaveDraft(): { save: () => Promise<boolean>; saving: boolean } {
  const { save: saveFlows, saving: savingFlows } = useSaveFlows();
  const [savingBlock, setSavingBlock] = useState(false);
  const save = useCallback(async () => {
    const draft = useFlowDraft.getState();
    const toast = useEditorStore.getState().showToast;
    const projectId = useEditorStore.getState().projectId;
    if (!projectId) return false;
    if (draft.target?.mode === "flows") {
      const { nodeId } = draft.target;
      const before = useFlowStore.getState().byNode[nodeId]?.version ?? null;
      if (await saveFlows(nodeId, draft.flows)) {
        draft.markSaved();
        return true;
      }
      // On a conflict the store now holds the latest saved flows: show them.
      const latest = useFlowStore.getState().byNode[nodeId];
      if (latest && latest.version !== before) {
        useFlowDraft.setState({
          flows: structuredClone(latest.flows),
          dirty: false,
          past: [],
          future: []
        });
      }
      return false;
    }
    if (!draft.block) return false;
    setSavingBlock(true);
    try {
      const result = await saveBlockAction(projectId, {
        baseVersion: draft.blockVersion,
        block: draft.block
      });
      if (result.error !== null) {
        toast(result.error);
        return false;
      }
      const outcome = result.data;
      if (outcome.ok) {
        draft.markSaved(outcome.version);
        return true;
      }
      if (outcome.reason === "name-taken") {
        toast("Another Action Block already has this name.");
        return false;
      }
      if (outcome.current) {
        useFlowDraft.setState({
          block: structuredClone(outcome.current.block),
          blockVersion: outcome.current.version,
          dirty: false,
          past: [],
          future: []
        });
      }
      toast("This block was changed elsewhere. The latest saved version is shown.");
      return false;
    } finally {
      setSavingBlock(false);
    }
  }, [saveFlows]);
  return { save, saving: savingFlows || savingBlock };
}

/** State and commands of the flow editor modal. */
export function useFlowEditor() {
  const load = useOpenDraft();
  const issues = useIssues();
  const { save, saving } = useSaveDraft();
  const close = useCallback(() => {
    const store = useFlowStore.getState();
    store.closeEditor();
    store.openBlock(null);
  }, []);
  return { load, issues, save, saving, close };
}
