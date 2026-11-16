"use client";

import { useState } from "react";
import { renameItemAction } from "@/app/(builder)/editor/[id]/library-actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { LibraryItem } from "@/server/library";
import { previewAddress } from "./screenshots";

/** Rename a page or template from the manager. */
export function RenameItemDialog({
  projectId,
  item,
  onClose,
  onRenamed
}: {
  projectId: string;
  item: LibraryItem;
  onClose: () => void;
  onRenamed: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const next = name.trim();
    if (next === "") return setError("Give it a name.");
    if (next === item.name) return onClose();
    setSaving(true);
    const result = await renameItemAction(projectId, item.kind, item.id, next);
    setSaving(false);
    if (result.error !== null) return setError(result.error);
    await onRenamed();
    onClose();
  }

  return (
    <Modal isOpen size="sm" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ModalHeader>Rename {item.kind}</ModalHeader>
          <ModalBody>
            <FormInput
              label="Name"
              autoFocus
              isRequired
              value={name}
              onValueChange={setName}
              isInvalid={Boolean(error)}
              errorMessage={error ?? undefined}
            />
          </ModalBody>
          <ModalFooter>
            <ActionButton tone="ghost" onPress={onClose}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" isLoading={saving}>
              Rename
            </ActionButton>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

/** The owner preview of a page or template, shown in a large modal. */
export function PreviewDialog({
  projectId,
  item,
  onClose
}: {
  projectId: string;
  item: LibraryItem;
  onClose: () => void;
}) {
  const address = previewAddress(projectId, item);
  return (
    <Modal isOpen size="full" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>Preview: {item.name}</ModalHeader>
        <ModalBody className="min-h-0 flex-1 p-0">
          <iframe
            title={`Preview of ${item.name}`}
            src={address}
            className="h-full min-h-[50vh] w-full rounded-xl border border-border bg-white"
          />
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={() => window.open(address, "_blank", "noopener")}>
            Open in new tab
          </ActionButton>
          <ActionButton onPress={onClose}>Close</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
