"use client";

import { formatBytes, type MediaAsset, type MediaKind } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { Busy } from "@/components/ui/busy";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Icon } from "@/lib/icons/Icon";
import { MediaThumb, mediaLabel } from "./media-thumb";
import { UploadList } from "./upload-list";
import { useMedia } from "./use-media";

const ALL = "__all";

function PickerBody({
  projectId,
  kinds,
  onPick,
  onClose
}: {
  projectId: string;
  kinds: MediaKind[];
  onPick: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const model = useMedia(projectId, { kinds });
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { patch } = model;

  useEffect(() => {
    const t = window.setTimeout(() => patch({ search: search.trim() }), 250);
    return () => window.clearTimeout(t);
  }, [search, patch]);

  const picked = model.assets.find((a) => a.id === chosen) ?? null;
  const isEmpty = !model.loading && model.assets.length === 0;

  return (
    <>
      <ModalHeader>Choose from Media</ModalHeader>
      <ModalBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1">
            <FormInput
              aria-label="Search media"
              placeholder="Search media"
              value={search}
              onValueChange={setSearch}
              isClearable
              onClear={() => setSearch("")}
              startContent={<Icon name="ph:magnifying-glass" width={14} height={14} />}
            />
          </div>
          <div className="w-44">
            <SelectField
              label="Folder"
              hideLabel
              value={model.query.folderId ?? ALL}
              onValueChange={(v) => patch({ folderId: v === ALL ? null : v })}
              options={[
                { value: ALL, label: "All files" },
                ...model.folders.map((f) => ({ value: f.id, label: f.name }))
              ]}
            />
          </div>
          <ActionButton
            tone="secondary"
            size="sm"
            startContent={<Icon name="ph:upload-simple" width={14} height={14} />}
            onPress={() => input.current?.click()}
          >
            Upload
          </ActionButton>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            aria-label="Choose files to upload"
            data-testid="media-picker-file-input"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length === 0) return;
              const last = await model.upload(files);
              if (last) setChosen(last.id);
            }}
          />
        </div>
        <UploadList uploads={model.uploads} onDismiss={model.dismissUpload} />
        {model.loadError && model.assets.length === 0 ? (
          <p role="alert" className="text-sm text-danger">
            {model.loadError}
          </p>
        ) : model.loading && model.assets.length === 0 ? (
          <div className="flex justify-center py-10">
            <Busy label="Loading media" />
          </div>
        ) : isEmpty ? (
          <p className="py-10 text-center text-sm text-muted">
            {model.query.search || model.query.folderId
              ? "No files match."
              : "No matching files yet. Upload one to use it here."}
          </p>
        ) : (
          <ul
            aria-label="Media files"
            className="grid max-h-[50vh] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 overflow-y-auto p-1"
          >
            {model.assets.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={chosen === a.id}
                  aria-label={`Choose ${mediaLabel(a)}`}
                  onClick={() => setChosen(a.id)}
                  onDoubleClick={() => onPick(a)}
                  className={`flex w-full flex-col overflow-hidden rounded-2xl border text-left transition-colors ${chosen === a.id ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-muted"}`}
                >
                  <MediaThumb asset={a} className="aspect-square w-full" />
                  <span className="truncate px-2 py-1.5 text-xs text-foreground">
                    {mediaLabel(a)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {model.assets.length < model.total ? (
          <div className="flex justify-center">
            <ActionButton
              tone="secondary"
              size="sm"
              isLoading={model.loadingMore}
              onPress={model.loadMore}
            >
              Load more
            </ActionButton>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <p className="mr-auto truncate text-xs text-muted">
          {picked ? `${mediaLabel(picked)} · ${formatBytes(picked.size)}` : ""}
        </p>
        <ActionButton tone="secondary" size="md" onPress={onClose}>
          Cancel
        </ActionButton>
        <ActionButton
          tone="primary"
          size="md"
          isDisabled={!picked}
          onPress={() => picked && onPick(picked)}
        >
          Use file
        </ActionButton>
      </ModalFooter>
    </>
  );
}

/** Pick one file from the Media library; a double click picks at once. Uploading works here too. */
export function MediaPickerDialog({
  projectId,
  kinds,
  isOpen,
  onClose,
  onPick
}: {
  projectId: string;
  kinds: MediaKind[];
  isOpen: boolean;
  onClose: () => void;
  onPick: (asset: MediaAsset) => void;
}) {
  if (!isOpen) return null;
  return (
    <Modal isOpen onClose={onClose} size="4xl">
      <ModalContent>
        <PickerBody projectId={projectId} kinds={kinds} onPick={onPick} onClose={onClose} />
      </ModalContent>
    </Modal>
  );
}
