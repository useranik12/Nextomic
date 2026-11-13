"use client";

import { mediaTagsSchema } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { CheckField } from "@/components/ui/toggles";
import { useTrashFlow } from "./trash-flow";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/menu";
import { Icon } from "@/lib/icons/Icon";
import type { MediaModel } from "./use-media";

/** Actions on the selected files: move, tag, trash (or restore and delete forever in the trash). */
export function BulkBar({ model }: { model: MediaModel }) {
  const ids = [...model.selected];
  const allSelected =
    model.assets.length > 0 && model.assets.every((a) => model.selected.has(a.id));
  const inTrash = model.query.filter === "trash";
  const flow = useTrashFlow(model, () => model.select(new Set()));
  const [tagging, setTagging] = useState(false);
  const [tags, setTags] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function applyTags() {
    const parsed = mediaTagsSchema.safeParse(
      tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    );
    if (!parsed.success || parsed.data.length === 0)
      return setTagError(
        parsed.success
          ? "Enter at least one tag."
          : (parsed.error.issues[0]?.message ?? "Invalid tag.")
      );
    setBusy(true);
    const done = await model.tag(ids, parsed.data);
    setBusy(false);
    if (done !== null) {
      setTagging(false);
      setTags("");
    }
  }

  return (
    <>
      {model.selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="Selected files"
          className="flex flex-wrap items-center gap-2 whitespace-nowrap rounded-2xl border border-border bg-surface px-3 py-2 [&>*]:shrink-0"
        >
          <CheckField
            label={allSelected ? "Deselect all" : "Select all"}
            isSelected={allSelected}
            isIndeterminate={!allSelected}
            onChange={() =>
              model.select(allSelected ? new Set() : new Set(model.assets.map((a) => a.id)))
            }
          />
          <span className="px-1 text-sm text-foreground">{model.selected.size} selected</span>
          {inTrash ? (
            <>
              <ActionButton
                tone="secondary"
                size="sm"
                className="shrink-0 whitespace-nowrap min-w-fit!"
                onPress={() => void model.restore(ids)}
              >
                Restore
              </ActionButton>
              <ActionButton
                tone="danger-ghost"
                size="sm"
                className="shrink-0 whitespace-nowrap min-w-fit!"
                isLoading={flow.busy}
                onPress={() => void flow.purge(ids)}
              >
                Delete forever
              </ActionButton>
            </>
          ) : (
            <>
              <Dropdown placement="bottom-start">
                <DropdownTrigger>
                  <ActionButton
                    tone="secondary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap min-w-fit! flex-row! items-center! gap-1.5"
                  >
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Icon name="ph:folder" width={14} height={14} />
                      Move to
                    </span>
                  </ActionButton>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Move to folder"
                  className="max-h-[50vh] overflow-y-auto"
                  onAction={(key) => void model.move(ids, key === "root" ? null : String(key))}
                >
                  <DropdownItem id="root">All files (no folder)</DropdownItem>
                  {model.folders.map((f) => (
                    <DropdownItem key={f.id} id={f.id}>
                      {f.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
              <ActionButton
                tone="secondary"
                size="sm"
                className="shrink-0 whitespace-nowrap min-w-fit!"
                startContent={<Icon name="ph:tag" width={14} height={14} />}
                onPress={() => setTagging(true)}
              >
                Add tags
              </ActionButton>
              <ActionButton
                tone="danger-ghost"
                size="sm"
                className="shrink-0 whitespace-nowrap min-w-fit!"
                isLoading={flow.busy}
                startContent={<Icon name="ph:trash" width={14} height={14} />}
                onPress={() => void flow.trash(ids)}
              >
                Move to trash
              </ActionButton>
            </>
          )}
          <ActionButton
            tone="ghost"
            size="sm"
            className="shrink-0 whitespace-nowrap min-w-fit!"
            onPress={() => model.select(new Set())}
          >
            Clear
          </ActionButton>
        </div>
      ) : inTrash && (model.counts?.trash ?? 0) > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-2">
          <p className="text-sm text-muted">
            Trashed files keep working until they are deleted for good.
          </p>
          <ActionButton tone="danger-ghost" size="sm" onPress={flow.emptyTrash}>
            Empty trash
          </ActionButton>
        </div>
      ) : null}

      {flow.dialog}
      <Dialog
        isOpen={tagging}
        onClose={() => setTagging(false)}
        size="sm"
        title="Add tags"
        description="Separate tags with commas. They are added to every selected file."
        footer={
          <>
            <ActionButton tone="secondary" size="md" onPress={() => setTagging(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              tone="primary"
              size="md"
              isLoading={busy}
              onPress={() => void applyTags()}
            >
              Add tags
            </ActionButton>
          </>
        }
      >
        <FormInput
          label="Tags"
          value={tags}
          onValueChange={(v) => {
            setTags(v);
            setTagError(null);
          }}
          autoFocus
          isInvalid={tagError !== null}
          errorMessage={tagError}
          onKeyDown={(e) => {
            if (e.key === "Enter") void applyTags();
          }}
        />
      </Dialog>
    </>
  );
}
