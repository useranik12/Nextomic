"use client";

import type { LibraryItem } from "@/server/library";
import { VirtualList } from "@/components/ui/virtual-list";
import { formatDate } from "./library-filter";
import {
  ActionIcons,
  AuthBadge,
  itemSubtitle,
  RowMenu,
  StatusChip,
  type RowAction
} from "./library-parts";
import { Thumb } from "./screenshots";

interface ViewProps {
  projectId: string;
  items: readonly LibraryItem[];
  selectedId: string | null;
  /** Whether app sign-in is on, so a locked page can say if the lock is enforced yet. */
  authOn: boolean;
  onSelect: (id: string) => void;
  onOpen: (item: LibraryItem) => void;
  onAction: (item: LibraryItem, action: RowAction) => void;
}

/** Cards with a screenshot, status and lock chips top right. The selected card shows its icons and menu. */
export function LibraryGrid({
  projectId,
  items,
  selectedId,
  authOn,
  onSelect,
  onOpen,
  onAction
}: ViewProps) {
  return (
    <ul
      aria-label="Items"
      className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id}>
            <div
              data-library-item
              className={
                "flex flex-col overflow-hidden rounded-2xl border bg-surface transition-colors duration-300 " +
                (selected ? "border-focus" : "border-border hover:border-default-400")
              }
            >
              <div className="relative">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Select ${item.name}`}
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => onOpen(item)}
                  className="block aspect-[8/5] w-full overflow-hidden text-left outline-none focus-visible:ring-1 focus-visible:ring-focus/30"
                >
                  <Thumb projectId={projectId} item={item} className="h-full w-full" />
                </button>
                <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5">
                  <span className="pointer-events-auto">
                    <AuthBadge item={item} authOn={authOn} />
                  </span>
                  <span className="pointer-events-auto rounded-full bg-surface/90 backdrop-blur">
                    <StatusChip status={item.status} />
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-muted">{itemSubtitle(item)}</p>
                </div>
                <p className="truncate text-xs text-muted">
                  {item.createdBy || "Unknown"} · Updated {formatDate(item.updatedAt)}
                </p>
                <div className="flex h-8 items-center [&>*]:w-full">
                  {selected ? (
                    <ActionIcons item={item} onAction={(a) => onAction(item, a)} />
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const COLUMNS =
  "grid grid-cols-[70px_72px_minmax(160px,2fr)_minmax(100px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_140px_40px] items-center gap-3 px-4";
const ROW_HEIGHT = 76;

/** Rows: ID, a 60px screenshot, name, creator, dates, status (with the lock) and a menu. */
export function LibraryTable({
  projectId,
  items,
  selectedId,
  authOn,
  onSelect,
  onOpen,
  onAction
}: ViewProps) {
  return (
    <div role="table" aria-label="Items" className="flex min-h-0 flex-1 flex-col">
      <div
        role="row"
        className={`${COLUMNS} h-10 border-b border-border text-xs font-medium text-muted overflow-y-hidden [scrollbar-gutter:stable]`}
      >
        <span role="columnheader">ID</span>
        <span role="columnheader">Screenshot</span>
        <span role="columnheader">Name</span>
        <span role="columnheader">Created by</span>
        <span role="columnheader">Published on</span>
        <span role="columnheader">Updated on</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">
          <span className="sr-only">Actions</span>
        </span>
      </div>
      <VirtualList
        items={items}
        rowHeight={ROW_HEIGHT}
        getKey={(item) => item.id}
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
        renderRow={(item) => {
          const selected = item.id === selectedId;
          return (
            <div
              role="row"
              data-library-item
              aria-selected={selected}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onOpen(item)}
              className={
                `${COLUMNS} h-full cursor-default border-b border-border text-sm transition-colors duration-300 ` +
                (selected ? "bg-default" : "hover:bg-default/40")
              }
            >
              <span role="cell" className="truncate font-mono text-xs text-muted" title={item.id}>
                {item.id.slice(0, 8)}
              </span>
              <span role="cell">
                <Thumb projectId={projectId} item={item} className="h-[60px] w-[60px] rounded-xl" />
              </span>
              <span role="cell" className="min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(item);
                  }}
                  className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
                >
                  {item.name}
                </button>
                <span className="block truncate text-xs text-muted">{itemSubtitle(item)}</span>
              </span>
              <span role="cell" className="truncate text-body">
                {item.createdBy || "Unknown"}
              </span>
              <span role="cell" className="text-body">
                {formatDate(item.publishedAt)}
              </span>
              <span role="cell" className="text-body">
                {formatDate(item.updatedAt)}
              </span>
              <span role="cell" className="flex items-center gap-1.5">
                <StatusChip status={item.status} />
                <AuthBadge item={item} authOn={authOn} />
              </span>
              <span role="cell" onClick={(e) => e.stopPropagation()}>
                <RowMenu item={item} onAction={(a) => onAction(item, a)} />
              </span>
            </div>
          );
        }}
      />
    </div>
  );
}
