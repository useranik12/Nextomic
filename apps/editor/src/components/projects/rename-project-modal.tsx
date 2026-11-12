"use client";

import type { Project } from "@nextomic/schema";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { useEffect, useState } from "react";

export interface RenameProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onRename: (project: Project, name: string) => Promise<void>;
}

export function RenameProjectModal({ project, onClose, onRename }: RenameProjectModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (project) setName(project.name);
  }, [project]);

  async function handleSubmit() {
    if (!project) return;
    if (!name.trim()) {
      setError("Give your project a name.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await onRename(project, name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename the project.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Modal isOpen={project !== null} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Rename project</ModalHeader>
        <ModalBody>
          <FormInput
            label="Project name"
            value={name}
            onValueChange={setName}
            isRequired
            autoFocus
            errorMessage={error}
            isInvalid={Boolean(error)}
          />
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" onPress={handleSubmit} isLoading={isPending}>
            Save
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
