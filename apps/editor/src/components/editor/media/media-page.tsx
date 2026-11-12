"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Busy } from "@/components/ui/busy";
import { Icon } from "@/lib/icons/Icon";
import { BulkBar } from "./bulk-bar";
import { DetailsPanel } from "./details-panel";
import { FoldersPanel } from "./folders-panel";
import { MediaGrid } from "./media-grid";
import { MediaToolbar, type MediaView } from "./media-toolbar";
import { UploadList } from "./upload-list";
import { useMedia } from "./use-media";

/** The Media page (`blueprint/inspiration/instatic-media-asset-manager.png`, Nextomic styling). */
export function MediaPage({ projectId }: { projectId: string }) {
  const model = useMedia(projectId);
  const [view, setView] = useState<MediaView>("grid");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { query, assets, loading, loadError } = model;
  const open = openId ? (assets.find((a) => a.id === openId) ?? null) : null;
  const inTrash = query.filter === "trash";
  const filtered =
    query.filter !== "all" ||
    query.type !== "all" ||
    query.search !== "" ||
    query.folderId !== null;

  const body = (() => {
    if (loadError && assets.length === 0)
      return (
        <div className="flex flex-col items-start gap-3 py-8">
          <p role="alert" className="text-sm text-danger">
            {loadError}
          </p>
          <ActionButton size="sm" tone="ghost" onPress={() => void model.refresh()}>
            Try again
          </ActionButton>
        </div>
      );
    if (loading && assets.length === 0)
      return (
        <div className="flex justify-center py-16">
          <Busy label="Loading media" />
        </div>
      );
    if (assets.length === 0)
      return (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          {inTrash ? (
            <Icon name="ph:tray" width={32} height={32} className="text-muted" />
          ) : (
            <Icon name="ph:image-square" width={32} height={32} className="text-muted" />
          )}
          <p className="text-sm font-medium text-foreground">
            {inTrash ? "The trash is empty" : filtered ? "No files match" : "No files yet"}
          </p>
          <p className="max-w-xs text-xs text-muted">
            {inTrash
              ? "Files you move to the trash wait here until you delete them for good."
              : filtered
                ? "Try another filter or clear the search."
                : "Drop images, SVGs, videos, audio or PDFs here, or press Upload."}
          </p>
        </div>
      );
    return (
      <>
        <MediaGrid
          assets={assets}
          view={view}
          selected={model.selected}
          openId={openId}
          onOpen={setOpenId}
          onSelect={model.select}
        />
        {assets.length < model.total ? (
          <div className="flex justify-center py-4">
            <ActionButton
              tone="secondary"
              size="sm"
              isLoading={model.loadingMore}
              onPress={model.loadMore}
            >
              Load more ({model.total - assets.length} left)
            </ActionButton>
          </div>
        ) : null}
      </>
    );
  })();

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-border p-4">
        <FoldersPanel model={model} />
      </aside>
      <div
        className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
        onDragOver={(e) => {
          if (inTrash || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          if (inTrash || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(false);
          const files = [...e.dataTransfer.files];
          if (files.length > 0) void model.upload(files);
        }}
      >
        <MediaToolbar model={model} view={view} onView={setView} />
        {model.notice ? (
          <p
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl bg-danger/10 px-4 py-2 text-sm text-danger"
          >
            {model.notice}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => model.setNotice(null)}
              className="shrink-0"
            >
              <Icon name="ph:x" width={14} height={14} />
            </button>
          </p>
        ) : null}
        <UploadList uploads={model.uploads} onDismiss={model.dismissUpload} />
        <BulkBar model={model} />
        {body}
        {dragging ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-accent/5 text-sm font-medium text-foreground"
          >
            Drop files to upload
          </div>
        ) : null}
      </div>
      {open ? (
        <aside aria-label="File details" className="w-96 shrink-0 border-l border-border">
          <DetailsPanel key={open.id} model={model} asset={open} onClose={() => setOpenId(null)} />
        </aside>
      ) : null}
    </div>
  );
}
