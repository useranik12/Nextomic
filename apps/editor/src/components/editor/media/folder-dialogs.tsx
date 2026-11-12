"use client";

import { mediaFolderNameSchema } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import type { MediaModel } from "./use-media";

type DialogState =
  | { kind: "create" }
  | { kind: "rename" | "delete"; id: string; name: string }
  | null;

/** Create, rename and delete-folder dialogs of the folders panel. */
export function FolderNameDialog({
  model,
  dialog,
  onClose
}: {
  model: MediaModel;
  dialog: DialogState;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(dialog && dialog.kind === "rename" ? dialog.name : "");
    setError(null);
  }, [dialog]);

  if (!dialog) return null;

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.kind === "delete") {
        await model.deleteFolder(dialog.id);
        return onClose();
      }
      const parsed = mediaFolderNameSchema.safeParse(name);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid name.");
      const result =
        dialog.kind === "create"
          ? await model.createFolder(parsed.data)
          : await model.renameFolder(dialog.id, parsed.data);
      if (result) onClose();
      else setError("That name is taken or the folder could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (dialog.kind === "delete")
    return (
      <Dialog
        isOpen
        onClose={onClose}
        size="sm"
        title="Delete folder"
        description={`“${dialog.name}” is removed. Its files move back to All files; nothing is deleted.`}
        footer={
          <>
            <ActionButton tone="secondary" size="md" onPress={onClose}>
              Cancel
            </ActionButton>
            <ActionButton tone="danger" size="md" isLoading={busy} onPress={() => void submit()}>
              Delete folder
            </ActionButton>
          </>
        }
      />
    );

  return (
    <Dialog
      isOpen
      onClose={onClose}
      size="sm"
      title={dialog.kind === "create" ? "New folder" : "Rename folder"}
      footer={
        <>
          <ActionButton tone="secondary" size="md" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" size="md" isLoading={busy} onPress={() => void submit()}>
            {dialog.kind === "create" ? "Create folder" : "Save"}
          </ActionButton>
        </>
      }
    >
      <FormInput
        label="Folder name"
        value={name}
        onValueChange={(v) => {
          setName(v);
          setError(null);
        }}
        maxLength={60}
        autoFocus
        isInvalid={error !== null}
        errorMessage={error}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />
    </Dialog>
  );
}
