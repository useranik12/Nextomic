"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from "@heroui/react";
import { pageNameSchema } from "@nextomic/schema";
import { useState } from "react";
import { deletePageAction, listPagesAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { openPage } from "./page-menu";
import { useEditorStore } from "./store/editor-store";
import type { PageSummary } from "@/server/pages";

// General section only. Appearance, Templates, SEO, Rendering, Custom code and Language appear as
// the features behind them are built (docs/ui-reference.md 4.11).
export function PageSettingsModal({
  pages,
  onPagesChange,
  saveNow,
  onClose
}: {
  pages: PageSummary[];
  onPagesChange: (pages: PageSummary[]) => void;
  saveNow: () => Promise<void>;
  onClose: () => void;
}) {
  const doc = useEditorStore((s) => s.doc);
  const pageId = useEditorStore((s) => s.page?.id);
  const updateMeta = useEditorStore((s) => s.updatePageMeta);
  const updateSettings = useEditorStore((s) => s.updatePageSettings);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!doc || !pageId) return null;

  const nameValid = pageNameSchema.safeParse(doc.name).success;

  async function remove() {
    const projectId = useEditorStore.getState().projectId;
    const result = await deletePageAction(projectId, pageId as string);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    const list = await listPagesAction(projectId);
    if (list.error === null) {
      onPagesChange(list.data);
      const next = list.data[0];
      if (next) await openPage(next.id, saveNow);
    }
    onClose();
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>Page settings</ModalHeader>
        <ModalBody className="gap-5">
          <FormInput
            label="Name"
            value={doc.name}
            onValueChange={(name) => updateMeta({ name })}
            isInvalid={!nameValid}
            errorMessage={nameValid ? undefined : "A page needs a name."}
          />
          <FormInput
            label="Internal description"
            value={doc.settings.description}
            onValueChange={(description) => updateSettings({ description })}
          />
          <Switch
            isSelected={doc.settings.includeInPublish}
            onValueChange={(includeInPublish) => updateSettings({ includeInPublish })}
          >
            Include in publish
          </Switch>
          <Switch
            isSelected={doc.settings.isHome}
            onValueChange={(isHome) => updateSettings({ isHome })}
          >
            Home page
          </Switch>
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
          {pages.length > 1 ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-small text-default-600">Delete this page for good?</span>
                <ActionButton tone="danger" size="sm" onPress={() => void remove()}>
                  Delete page
                </ActionButton>
                <ActionButton tone="ghost" size="sm" onPress={() => setConfirmDelete(false)}>
                  Keep
                </ActionButton>
              </div>
            ) : (
              <div>
                <ActionButton tone="danger-ghost" size="sm" onPress={() => setConfirmDelete(true)}>
                  Delete page
                </ActionButton>
              </div>
            )
          ) : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton onPress={onClose}>Done</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
