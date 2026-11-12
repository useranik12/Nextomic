"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { templateNameSchema } from "@nextomic/schema";
import { ActionButton } from "@/components/ui/controls";
import { BoltInput } from "./right-panel/bolt-input";
import { TemplateSettingsFields } from "./right-panel/template-options";
import { useEditorStore } from "./store/editor-store";

/** The settings of the open template, from the settings icon in the top bar (like Page settings). */
export function TemplateSettingsModal({ onClose }: { onClose: () => void }) {
  const name = useEditorStore((s) => s.doc?.name ?? "");
  const updateMeta = useEditorStore((s) => s.updatePageMeta);
  const valid = templateNameSchema.safeParse(name).success;
  return (
    <Modal isOpen size="2xl" onOpenChange={(open) => !open && onClose()} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Template settings</ModalHeader>
        <ModalBody className="gap-4">
          <BoltInput
            label="Name"
            value={name}
            onValueChange={(next) => updateMeta({ name: next })}
            isInvalid={!valid}
            errorMessage={valid ? undefined : "A template needs a name."}
          />
          <TemplateSettingsFields />
        </ModalBody>
        <ModalFooter>
          <ActionButton onPress={onClose}>Done</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
