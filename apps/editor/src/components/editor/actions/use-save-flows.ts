"use client";

import type { TriggerFlow } from "@nextomic/schema";
import { useCallback, useState } from "react";
import { saveFlowsAction } from "@/app/(builder)/editor/[id]/action-flow-actions";
import { useEditorStore } from "../store/editor-store";
import { useFlowStore } from "./flow-store";

/**
 * Saves every flow of one element right away (flows are saved apart from the page draft).
 * Returns true when saved; on a conflict the latest saved flows replace the local ones.
 */
export function useSaveFlows(): {
  save: (nodeId: string, flows: TriggerFlow[]) => Promise<boolean>;
  saving: boolean;
} {
  const [saving, setSaving] = useState(false);
  const save = useCallback(async (nodeId: string, flows: TriggerFlow[]) => {
    const { projectId, owner, byNode, setNodeFlows } = useFlowStore.getState();
    const toast = useEditorStore.getState().showToast;
    if (!projectId || !owner) return false;
    setSaving(true);
    try {
      const result = await saveFlowsAction(projectId, {
        ownerKind: owner.kind,
        ownerId: owner.id,
        nodeId,
        baseVersion: byNode[nodeId]?.version ?? null,
        flows
      });
      if (result.error !== null) {
        toast(result.error);
        return false;
      }
      const outcome = result.data;
      if (outcome.ok) {
        setNodeFlows(nodeId, { flows, version: outcome.version });
        return true;
      }
      if (outcome.reason === "not-found") {
        toast("Save the page first: this element is not saved yet.");
        return false;
      }
      setNodeFlows(nodeId, outcome.current ?? { flows: [], version: null });
      toast("These actions were changed elsewhere. The latest saved version is shown.");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);
  return { save, saving };
}
