"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Icon } from "@/lib/icons/Icon";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Picks when the project is published. At that moment the saved draft goes live, as if Publish
 * was pressed then; edits saved before that moment are included.
 */
export function ScheduleDialog({
  scheduledAt,
  onSchedule,
  onClose
}: {
  /** The current schedule (epoch ms), or null. */
  scheduledAt: number | null;
  /** Saves the schedule; resolves to an error message or null. */
  onSchedule: (iso: string | null) => Promise<string | null>;
  onClose: () => void;
}) {
  const [value, setValue] = useState<string | null>(
    new Date(scheduledAt ?? Date.now() + ONE_HOUR).toISOString()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(iso: string | null) {
    setBusy(true);
    const problem = await onSchedule(iso);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal isOpen onClose={onClose} backdrop="blur" size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon name="ph:calendar-blank" width={18} height={18} className="text-default-500" />
          Schedule publish
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-small text-default-600">
            The saved draft goes live for everyone at this time. Changes you save before then are
            included.
          </p>
          <DateTimeField label="Publish at" value={value} onChange={setValue} future />
          {error ? (
            <p role="alert" className="text-tiny text-danger">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter className="flex items-center">
          {scheduledAt !== null ? (
            <ActionButton
              tone="danger-ghost"
              className="mr-auto"
              isDisabled={busy}
              onPress={() => void submit(null)}
            >
              Remove schedule
            </ActionButton>
          ) : null}
          <ActionButton tone="ghost" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton isLoading={busy} isDisabled={!value} onPress={() => void submit(value)}>
            Schedule
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** Publish pressed while a publish is scheduled: publishing now removes the schedule. */
export function ReplaceScheduleDialog({
  scheduledAt,
  onConfirm,
  onCancel
}: {
  scheduledAt: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const when = new Date(scheduledAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
  return (
    <Modal isOpen onClose={onCancel} backdrop="blur" size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon name="ph:calendar-blank" width={18} height={18} className="text-default-500" />A
          publish is scheduled
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-default-600">
            The project is scheduled to publish on {when}. It can only have one publish state, so
            publishing now removes the schedule.
          </p>
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onCancel}>
            Keep schedule
          </ActionButton>
          <ActionButton onPress={onConfirm}>Publish now and remove schedule</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
