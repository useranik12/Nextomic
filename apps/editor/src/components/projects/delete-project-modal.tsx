"use client";

import type { Project } from "@nextomic/schema";
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import { Modal } from "@/components/ui/legacy-modal";
import { ActionButton } from "@/components/ui/controls";
import { useState } from "react";

export interface DeleteProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onDelete: (project: Project) => Promise<void>;
}

export function DeleteProjectModal({ project, onClose, onDelete }: DeleteProjectModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    if (!project) return;
    setIsPending(true);
    setError(null);
    try {
      await onDelete(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the project.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Modal isOpen={project !== null} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Delete project</ModalHeader>
        <ModalBody>
          <p className="text-default-600">
            Delete <strong>{project?.name}</strong>? This cannot be undone.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton tone="danger" onPress={handleConfirm} isLoading={isPending}>
            Delete
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
