"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/controls";

/** Shown when publishing while parameters or state variables are edited but not saved yet. */
export function UnsavedDraftsDialog({
  labels,
  onDiscard,
  onCancel
}: {
  labels: string[];
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen onClose={onCancel}>
      <ModalContent>
        <ModalHeader>Unsaved changes</ModalHeader>
        <ModalBody>
          <p className="text-sm text-body">
            Changes to {labels.join(" and ")} {labels.length > 1 ? "are" : "is"} not saved. Click
            the check icon of the group to save them, then publish. Discard drops these changes and
            publishes the page as it was saved.
          </p>
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton tone="danger" onPress={onDiscard}>
            Discard and publish
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
