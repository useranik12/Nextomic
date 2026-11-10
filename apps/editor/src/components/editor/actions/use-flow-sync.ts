"use client";

import { useEffect } from "react";
import { listFlowsAction } from "@/app/(builder)/editor/[id]/action-flow-actions";
import { useEditorStore } from "../store/editor-store";
import { useFlowStore, type NodeFlows } from "./flow-store";

/** Fetches the flows of the page or template the flow store shows. */
export async function fetchFlows(): Promise<void> {
  const { projectId, owner, loading, loaded } = useFlowStore.getState();
  if (!projectId || !owner) return;
  loading();
  const result = await listFlowsAction(projectId, owner.kind, owner.id);
  if (result.error !== null) return loaded(owner, { error: result.error });
  const byNode: Record<string, NodeFlows> = {};
  for (const row of result.data) byNode[row.nodeId] = { flows: row.flows, version: row.version };
  loaded(owner, { byNode });
}

/** Loads the flows of the open page or template, and marks its tree saved after each save. */
export function useFlowSync(): void {
  const projectId = useEditorStore((s) => s.projectId);
  const pageId = useEditorStore((s) => s.page?.id ?? null);
  const kind = useEditorStore((s) => s.page?.kind ?? "page");
  const savedTick = useEditorStore((s) => s.savedTick);

  useEffect(() => {
    const { doc } = useEditorStore.getState();
    if (!projectId || !pageId || !doc) return;
    useFlowStore.getState().begin(projectId, { kind, id: pageId }, doc.tree);
    void fetchFlows();
  }, [projectId, pageId, kind]);

  useEffect(() => {
    const { doc } = useEditorStore.getState();
    if (savedTick > 0 && doc) useFlowStore.getState().afterSave(doc.tree);
  }, [savedTick]);
}
