"use client";

import { useState, type ReactNode } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import type { MediaModel } from "./use-media";

type Confirm = { kind: "trash" | "purge" | "empty"; ids: string[]; used: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function message(c: Confirm): string {
  if (c.kind === "empty")
    return "Every file in the trash is deleted for good. This cannot be undone.";
  if (c.kind === "trash")
    return `${plural(c.used, "selected file is", "selected files are")} used on your site. Trashed files keep working until they are deleted for good, and you can restore them.`;
  return `${c.used > 0 ? `${plural(c.used, "of these files is", "of these files are")} still used on your site and will break. ` : ""}Deleted files cannot be restored.`;
}

/**
 * Trash, delete-forever and empty-trash with their confirmations. A file that is in use asks first;
 * trashing an unused file just happens. `dialog` must be rendered by the caller.
 */
export function useTrashFlow(model: MediaModel, onDone?: () => void) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(kind: "trash" | "purge", ids: string[]) {
    setBusy(true);
    const used = await model.inUse(ids);
    if (kind === "trash" && used.length === 0) {
      await model.trash(ids);
      setBusy(false);
      return onDone?.();
    }
    setBusy(false);
    setConfirm({ kind, ids, used: used.length });
  }

  async function confirmed() {
    if (!confirm) return;
    setBusy(true);
    if (confirm.kind === "trash") await model.trash(confirm.ids);
    else if (confirm.kind === "purge") await model.purge(confirm.ids);
    else await model.emptyTrash();
    setBusy(false);
    setConfirm(null);
    onDone?.();
  }

  const dialog: ReactNode = (
    <Dialog
      isOpen={confirm !== null}
      onClose={() => setConfirm(null)}
      size="sm"
      title={
        confirm?.kind === "trash"
          ? "Move to trash"
          : confirm?.kind === "empty"
            ? "Empty trash"
            : "Delete forever"
      }
      description={confirm ? message(confirm) : undefined}
      footer={
        <>
          <ActionButton tone="secondary" size="md" onPress={() => setConfirm(null)}>
            Cancel
          </ActionButton>
          <ActionButton
            tone={confirm?.kind === "trash" ? "primary" : "danger"}
            size="md"
            isLoading={busy}
            onPress={() => void confirmed()}
          >
            {confirm?.kind === "trash" ? "Move to trash" : "Delete forever"}
          </ActionButton>
        </>
      }
    />
  );

  return {
    busy,
    dialog,
    trash: (ids: string[]) => ask("trash", ids),
    purge: (ids: string[]) => ask("purge", ids),
    emptyTrash: () => setConfirm({ kind: "empty", ids: [], used: 0 })
  };
}
