"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState } from "react";
import { sendTestEmailAction } from "@/app/(builder)/(dashboard)/settings/smtp-actions";
import { ActionButton, FormInput } from "@/components/ui/controls";

/** Sends a test email with one account and shows how it went. */
export function SendTestDialog({
  accountId,
  accountName,
  defaultTo,
  onSent,
  onClose
}: {
  accountId: string;
  accountName: string;
  defaultTo: string;
  onSent: () => void;
  onClose: () => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setOutcome(null);
    const result = await sendTestEmailAction(accountId, to);
    setBusy(false);
    setOutcome(
      result.data === null ? { ok: false, text: result.error } : { ok: true, text: result.data }
    );
    onSent();
  }

  return (
    <Modal isOpen onClose={onClose} backdrop="blur" size="md">
      <ModalContent>
        <ModalHeader>Send test email</ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-small text-default-600">
            Sends a short message with{" "}
            <span className="font-medium text-foreground">{accountName}</span>.
          </p>
          <FormInput label="Send to" type="email" value={to} onValueChange={setTo} isRequired />
          {outcome ? (
            <p
              role={outcome.ok ? "status" : "alert"}
              className={`text-small ${outcome.ok ? "text-success" : "text-danger"}`}
            >
              {outcome.text}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onClose}>
            Done
          </ActionButton>
          <ActionButton isLoading={busy} isDisabled={!to.trim()} onPress={() => void send()}>
            Send test
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
