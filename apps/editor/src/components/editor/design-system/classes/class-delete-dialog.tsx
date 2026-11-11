"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";

const REMOVE = "__remove";

/** Deleting a class: if elements use it, choose what they get instead. The change waits for Save. */
export function ClassDeleteDialog({
  name,
  used,
  replacements,
  onConfirm,
  onCancel
}: {
  name: string;
  used: number;
  replacements: string[];
  onConfirm: (replaceWith: string | null) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState(REMOVE);
  return (
    <Modal isOpen onClose={onCancel} backdrop="blur">
      <ModalContent>
        <ModalHeader>Delete .{name}</ModalHeader>
        <ModalBody>
          <p className="text-small text-default-600">
            {used === 0
              ? "No element uses this class. Its styles are deleted."
              : `${used} element${used === 1 ? "" : "s"} use this class. Its styles are deleted; choose what the elements get instead.`}
          </p>
          {used > 0 ? (
            <SelectField
              label="Replace with"
              value={choice}
              onValueChange={setChoice}
              options={[
                { value: REMOVE, label: "Nothing (remove it from the elements)" },
                ...replacements.map((n) => ({ value: n, label: `.${n}` }))
              ]}
            />
          ) : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton tone="danger" onPress={() => onConfirm(choice === REMOVE ? null : choice)}>
            Delete class
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
