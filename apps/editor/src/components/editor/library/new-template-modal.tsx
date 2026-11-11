"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import {
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  createTemplateInputSchema,
  type TemplateType
} from "@nextomic/schema";
import { useState } from "react";
import { createTemplateAction } from "@/app/(builder)/editor/[id]/library-actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";

/** Header, footer and 404 are the template types of this version. */
export function NewTemplateModal({
  projectId,
  initialType = "header",
  onClose,
  onCreated
}: {
  projectId: string;
  initialType?: TemplateType;
  onClose: () => void;
  onCreated: (templateId: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>(initialType);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const parsed = createTemplateInputSchema.safeParse({ name, type });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the name.");
      return;
    }
    setSaving(true);
    const result = await createTemplateAction(projectId, parsed.data);
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    await onCreated(result.data.id);
    onClose();
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} backdrop="blur">
      <ModalContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ModalHeader>New template</ModalHeader>
          <ModalBody className="gap-5">
            <FormInput
              label="Name"
              autoFocus
              isRequired
              value={name}
              onValueChange={setName}
              isInvalid={Boolean(error)}
              errorMessage={error ?? undefined}
            />
            <SelectField
              label="Type"
              value={type}
              onValueChange={(v) => setType(v as TemplateType)}
              options={TEMPLATE_TYPES.map((t) => ({ value: t, label: TEMPLATE_TYPE_LABELS[t] }))}
            />
          </ModalBody>
          <ModalFooter>
            <ActionButton tone="ghost" onPress={onClose}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" isLoading={saving}>
              Create template
            </ActionButton>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
