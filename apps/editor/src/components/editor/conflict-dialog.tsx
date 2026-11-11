"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import { savePageAction } from "@/app/(builder)/editor/[id]/actions";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { useEditorStore } from "./store/editor-store";

/** Shown when the server has a newer version than the one this editor started from. */
export function ConflictDialog() {
  const conflict = useEditorStore((s) => s.conflict);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!conflict) return null;

  async function keepMine() {
    const state = useEditorStore.getState();
    if (!state.conflict || !state.doc) return;
    setBusy(true);
    // Overwrite deliberately: rebase my document onto the server's current version number.
    const result = await savePageAction(state.projectId, state.conflict.page.id, {
      baseVersion: state.conflict.page.version,
      name: state.doc.name,
      route: state.doc.route,
      settings: state.doc.settings,
      tree: state.doc.tree
    });
    setBusy(false);
    if (result.error !== null || !result.data.ok) {
      setError(result.error ?? "The page changed again. Try once more.");
      return;
    }
    const doc = state.doc;
    state.loadPage({ id: result.data.page.id, version: result.data.page.version }, doc);
    setError(null);
  }

  return (
    <Modal isOpen isDismissable={false} hideCloseButton backdrop="blur">
      <ModalContent>
        <ModalHeader>This page was changed elsewhere</ModalHeader>
        <ModalBody>
          <p className="text-small text-default-600">
            Someone saved a newer version (v{conflict.page.version}) while you were editing. Keep
            your changes to overwrite it, or load the newer version and drop what you changed here.
            Either way the other version stays in Version History.
          </p>
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton
            tone="ghost"
            onPress={() => useEditorStore.getState().resolveConflictWithServer()}
          >
            Load newer version
          </ActionButton>
          <ActionButton isLoading={busy} onPress={() => void keepMine()}>
            Keep my changes
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
