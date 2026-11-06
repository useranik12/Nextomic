"use client";

import { useCallback, useRef, useState } from "react";
import {
  renameCssVarsAction,
  renameVariableAction,
  replaceClassAction
} from "@/app/(builder)/editor/[id]/actions";
import { useEditorStore, type PendingOp } from "../store/editor-store";

type Base = Pick<
  ReturnType<typeof useEditorStore.getState>,
  "project" | "doc" | "past" | "future" | "saveStatus" | "classesTick" | "activeClass"
>;

function capture(): Base {
  const s = useEditorStore.getState();
  return {
    project: s.project,
    doc: s.doc,
    past: s.past,
    future: s.future,
    saveStatus: s.saveStatus,
    classesTick: s.classesTick,
    activeClass: s.activeClass
  };
}

async function runOp(projectId: string, pageId: string, op: PendingOp) {
  if (op.type === "renameVariable") return renameVariableAction(projectId, pageId, op.from, op.to);
  if (op.type === "renameCssVars") return renameCssVarsAction(projectId, pageId, op.pairs);
  if (op.type === "renameClass") return replaceClassAction(projectId, pageId, op.from, op.to);
  return replaceClassAction(projectId, pageId, op.name, op.to);
}

/**
 * Everything edited in the Design System is a draft until Save: edits show in the canvas at once
 * (they live in the editor store) but only Save writes them. Closing without saving restores the
 * state the modal opened with. Renames and deletes that rewrite other saved pages wait in
 * `pendingOps` and run on Save.
 */
export function useDesignDraft(saveNow: () => Promise<void>) {
  const base = useRef<Base>(capture());
  const project = useEditorStore((s) => s.project);
  const doc = useEditorStore((s) => s.doc);
  const ops = useEditorStore((s) => s.pendingOps);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = project !== base.current.project || doc !== base.current.doc || ops.length > 0;

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const state = useEditorStore.getState();
    const pageId = state.page?.id;
    const queue = [...state.pendingOps];
    if (queue.length > 0 && !pageId) {
      setSaving(false);
      setError("Open a page before saving renames.");
      return false;
    }
    while (queue[0] && pageId) {
      const result = await runOp(state.projectId, pageId, queue[0]);
      if (result.error !== null) {
        useEditorStore.setState({ pendingOps: queue });
        setSaving(false);
        setError(result.error);
        return false;
      }
      queue.shift();
    }
    useEditorStore.getState().clearOps();
    await saveNow();
    const after = useEditorStore.getState();
    setSaving(false);
    if (after.saveStatus === "error" || after.saveStatus === "conflict") {
      setError(after.saveError ?? "The changes could not be saved.");
      return false;
    }
    base.current = capture();
    return true;
  }, [saveNow]);

  const discard = useCallback(() => {
    useEditorStore.setState({ ...base.current, pendingOps: [] });
  }, []);

  return { dirty, saving, error, save, discard };
}
