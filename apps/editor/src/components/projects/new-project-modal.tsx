"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { useState } from "react";

export interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Give your project a name.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>New Project</ModalHeader>
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
            Create
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
