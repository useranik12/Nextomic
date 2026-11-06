"use client";

import { useCallback, useEffect, useRef } from "react";
import { saveProjectSettingsAction, savePageAction } from "@/app/(builder)/editor/[id]/actions";
import { saveTemplateAction } from "@/app/(builder)/editor/[id]/library-actions";
import { useEditorStore } from "./store/editor-store";

/**
 * Saves only on request (Save, Publish, Ctrl+S): unsaved edits are gone after a refresh. The base
 * version travels with every save; a mismatch means someone else saved first and the store
 * switches to the conflict state instead of overwriting.
 */
export function useAutosave(): { saveNow: () => Promise<void> } {
  const inFlight = useRef(false);
  const savedClassesTick = useRef(0);

  const saveNow = useCallback(async () => {
    const state = useEditorStore.getState();
    if (
      !state.doc ||
      !state.page ||
      inFlight.current ||
      state.saveStatus === "conflict" ||
      state.saveStatus === "saved"
    )
      return;
    inFlight.current = true;
    const saved = state.doc;
    const classesTick = state.classesTick;
    state.setSaveStatus("saving");
    try {
      // Class styles belong to the project settings and save together with the page.
      if (classesTick !== savedClassesTick.current) {
        const settingsResult = await saveProjectSettingsAction(state.projectId, state.project);
        if (settingsResult.error !== null) {
          useEditorStore.getState().setSaveStatus("error", settingsResult.error);
          return;
        }
        savedClassesTick.current = classesTick;
      }
      if (state.page.kind === "template") {
        const outcome = await saveTemplateAction(state.projectId, state.page.id, {
          baseVersion: state.page.version,
          name: saved.name,
          settings: saved.template,
          tree: saved.tree
        });
        const now = useEditorStore.getState();
        if (outcome.error !== null) {
          now.setSaveStatus("error", outcome.error);
          return;
        }
        const data = outcome.data;
        if (data.ok) {
          const stillSame = now.doc === saved;
          now.markSaved(data.template.version);
          if (!stillSame || now.classesTick !== classesTick) now.setSaveStatus("dirty");
        } else if (data.reason === "conflict") {
          now.setConflict(
            {
              id: data.template.id,
              version: data.template.version,
              kind: "template",
              templateType: data.template.type
            },
            {
              name: data.template.name,
              route: "",
              settings: saved.settings,
              tree: data.template.tree,
              template: data.template.settings
            }
          );
        } else {
          now.setSaveStatus("error", "This template no longer exists.");
        }
        return;
      }
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
        if (!stillSame || current.classesTick !== classesTick) current.setSaveStatus("dirty");
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
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

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
