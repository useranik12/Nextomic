"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";

/** Delete (with confirm), Cancel and Save under a group or call editor. */
export function EditorFooter({
  deleteLabel,
  saveLabel,
  confirmTitle,
  confirmText,
  canDelete,
  dirty,
  saving,
  onDelete,
  onCancel,
  onSave
}: {
  deleteLabel: string;
  saveLabel: string;
  confirmTitle: string;
  confirmText: ReactNode;
  canDelete: boolean;
  dirty: boolean;
  saving: boolean;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-4">
      <ActionButton
        size="sm"
        tone="danger-ghost"
        className="border border-danger"
        isDisabled={!canDelete || saving}
        onPress={() => setConfirm(true)}
      >
        <Icon name="ph:trash" width={14} height={14} />
        {deleteLabel}
      </ActionButton>
      <div className="flex gap-2">
        <ActionButton
          size="sm"
          tone="ghost"
          className="border border-default-200"
          isDisabled={!dirty || saving}
          onPress={onCancel}
        >
          <Icon name="ph:x" width={14} height={14} />
          Cancel
        </ActionButton>
        <ActionButton size="sm" isLoading={saving} isDisabled={!dirty} onPress={onSave}>
          <Icon name="ph:download-simple" width={14} height={14} />
          {saveLabel}
        </ActionButton>
      </div>
      <Modal isOpen={confirm} onOpenChange={setConfirm} size="md">
        <ModalContent>
          <ModalHeader>{confirmTitle}</ModalHeader>
          <ModalBody className="text-small text-default-600">{confirmText}</ModalBody>
          <ModalFooter>
            <ActionButton size="sm" tone="ghost" onPress={() => setConfirm(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              size="sm"
              tone="danger"
              onPress={() => {
                setConfirm(false);
                onDelete();
              }}
            >
              {deleteLabel}
            </ActionButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
