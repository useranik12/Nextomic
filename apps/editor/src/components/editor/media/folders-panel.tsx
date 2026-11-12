"use client";

import type { MediaFilter } from "@nextomic/schema";
import { useState } from "react";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/menu";
import { Icon } from "@/lib/icons/Icon";
import { FolderNameDialog } from "./folder-dialogs";
import type { MediaModel } from "./use-media";

const ROW =
  "flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left text-sm transition-colors duration-300 ";

function Row({
  label,
  count,
  current,
  onPick,
  icon
}: {
  label: string;
  count?: number;
  current: boolean;
  onPick: () => void;
  icon?: "ph:folder" | "ph:tray";
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current}
        onClick={onPick}
        className={`${ROW}${current ? "bg-default text-foreground" : "text-body hover:bg-default/40"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon === "ph:tray" ? (
            <Icon name="ph:tray" width={16} height={16} className="shrink-0" />
          ) : icon ? (
            <Icon name="ph:folder" width={16} height={16} className="shrink-0" />
          ) : null}
          <span className="truncate">{label}</span>
        </span>
        {count !== undefined ? <span className="text-xs text-muted">{count}</span> : null}
      </button>
    </li>
  );
}

const LIBRARY: {
  filter: MediaFilter;
  label: string;
  count: (c: NonNullable<MediaModel["counts"]>) => number;
}[] = [
  { filter: "all", label: "All files", count: (c) => c.all },
  { filter: "missing-alt", label: "Missing alt text", count: (c) => c.missingAlt },
  { filter: "missing-title", label: "Missing title", count: (c) => c.missingTitle },
  { filter: "untagged", label: "Untagged", count: (c) => c.untagged },
  { filter: "large", label: "Large files", count: (c) => c.large },
  { filter: "replaced", label: "Recently replaced", count: (c) => c.replaced }
];

/** Left column of the Media page: smart filters, folders and the trash. */
export function FoldersPanel({ model }: { model: MediaModel }) {
  const { query, counts, folders } = model;
  const [dialog, setDialog] = useState<
    { kind: "create" } | { kind: "rename" | "delete"; id: string; name: string } | null
  >(null);
  const inLibrary = query.folderId === null && query.filter !== "trash";

  return (
    <nav aria-label="Media folders" className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="px-2 text-base font-semibold text-foreground">Folders</h2>
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted">Library</p>
      </div>
      <ul className="flex flex-col gap-0.5">
        {LIBRARY.map((item) => (
          <Row
            key={item.filter}
            label={item.label}
            count={counts ? item.count(counts) : undefined}
            current={inLibrary && query.filter === item.filter}
            onPick={() => model.patch({ filter: item.filter, folderId: null })}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between px-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Folders</p>
        <button
          type="button"
          aria-label="New folder"
          onClick={() => setDialog({ kind: "create" })}
          className="flex h-7 w-7 items-center justify-center rounded-full text-body hover:bg-default hover:text-foreground"
        >
          <Icon name="ph:folder-plus" width={16} height={16} />
        </button>
      </div>
      {folders.length === 0 ? (
        <p className="px-4 text-xs text-muted">No folders yet. Press the folder icon to add one.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {folders.map((f) => (
            <li key={f.id} className="group relative">
              <button
                type="button"
                aria-current={query.folderId === f.id && query.filter !== "trash"}
                onClick={() => model.patch({ folderId: f.id, filter: "all" })}
                className={`${ROW}pr-11 ${query.folderId === f.id && query.filter !== "trash" ? "bg-default text-foreground" : "text-body hover:bg-default/40"}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon name="ph:folder" width={16} height={16} className="shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-xs text-muted group-hover:invisible">
                  {counts?.byFolder[f.id] ?? 0}
                </span>
              </button>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <button
                    type="button"
                    aria-label={`Folder options for ${f.name}`}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-body opacity-0 hover:bg-default hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="ph:dots-three" width={16} height={16} />
                  </button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label={`Folder options for ${f.name}`}
                  onAction={(key) =>
                    setDialog({
                      kind: key === "rename" ? "rename" : "delete",
                      id: f.id,
                      name: f.name
                    })
                  }
                >
                  <DropdownItem id="rename">Rename</DropdownItem>
                  <DropdownItem id="delete" color="danger">
                    Delete folder
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </li>
          ))}
        </ul>
      )}
      <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted">System</p>
      <ul>
        <Row
          label="Trash"
          icon="ph:tray"
          count={counts?.trash}
          current={query.filter === "trash"}
          onPick={() => model.patch({ filter: "trash", folderId: null })}
        />
      </ul>
      <FolderNameDialog model={model} dialog={dialog} onClose={() => setDialog(null)} />
    </nav>
  );
}
