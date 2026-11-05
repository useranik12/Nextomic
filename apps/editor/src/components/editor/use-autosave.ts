"use client";

import { useCallback, useEffect, useRef } from "react";
import { savePageAction } from "@/app/(builder)/editor/[id]/actions";
import { useEditorStore } from "./store/editor-store";

const AUTOSAVE_DELAY_MS = 1200;

/**
 * Saves the document shortly after the last edit. The base version travels with every save; a
 * mismatch means someone else saved first and the store switches to the conflict state instead of
 * overwriting.
 */
export function useAutosave(): { saveNow: () => Promise<void> } {
  const doc = useEditorStore((s) => s.doc);
  const status = useEditorStore((s) => s.saveStatus);
  const inFlight = useRef(false);

  const saveNow = useCallback(async () => {
    const state = useEditorStore.getState();
    if (!state.doc || !state.page || inFlight.current || state.saveStatus === "conflict") return;
    inFlight.current = true;
    const saved = state.doc;
    state.setSaveStatus("saving");
    try {
      const result = await savePageAction(state.projectId, state.page.id, {
        baseVersion: state.page.version,
        name: saved.name,
        route: saved.route,
        settings: saved.settings,
        tree: saved.tree
      });
      const current = useEditorStore.getState();
      if (result.error !== null) {
        current.setSaveStatus("error", result.error);
        return;
      }
      const outcome = result.data;
      if (outcome.ok) {
        // Edits made while the request was in flight stay "dirty" and save on the next tick.
        const stillSame = current.doc === saved;
        current.markSaved(outcome.page.version);
        if (!stillSame) current.setSaveStatus("dirty");
      } else if (outcome.reason === "conflict") {
        current.setConflict(
          { id: outcome.page.id, version: outcome.page.version },
          {
            name: outcome.page.name,
            route: outcome.page.route,
            settings: outcome.page.settings,
            tree: outcome.page.tree
          }
        );
      } else if (outcome.reason === "route-taken") {
        current.setSaveStatus("error", "That route is already used by another page.");
      } else {
        current.setSaveStatus("error", "This page no longer exists.");
      }
    } catch {
      useEditorStore.getState().setSaveStatus("error", "Could not reach the server.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (status !== "dirty") return;
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [doc, status, saveNow]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const { saveStatus } = useEditorStore.getState();
      if (saveStatus === "dirty" || saveStatus === "saving") event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { saveNow };
}
