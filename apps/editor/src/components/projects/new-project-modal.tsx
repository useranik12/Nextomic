"use client";

import { useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";

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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="New Project"
      description="A project holds the pages, templates and settings of one site or app."
      footer={
        <>
          <ActionButton tone="secondary" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" form="new-project-form" isLoading={isPending}>
            Create
          </ActionButton>
        </>
      }
    >
      <form
        id="new-project-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <FormInput
          label="Project name"
          value={name}
          onValueChange={(next) => {
            setName(next);
            if (error) setError(null);
          }}
          isRequired
          autoFocus
          validationBehavior="aria"
          errorMessage={error}
          isInvalid={Boolean(error)}
        />
      </form>
    </Dialog>
  );
}
