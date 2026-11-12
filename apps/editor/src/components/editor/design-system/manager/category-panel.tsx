"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";

export interface CategoryItem {
  /** Stable id used for selection. */
  id: string;
  name: string;
  count: number;
  badge?: string;
  /** User categories can be renamed and deleted. */
  editable: boolean;
}

/**
 * Categories of a manager: All, the categories with counts, and an input to add one. Editable
 * categories show rename and delete on hover or focus.
 */
export function CategoryPanel({
  title,
  total,
  items,
  selected,
  onSelect,
  onAdd,
  onRename,
  onDelete
}: {
  title: string;
  total: number;
  items: CategoryItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string) => string | null;
  onRename: (id: string, to: string) => string | null;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add() {
    const failed = onAdd(draft.trim());
    setError(failed);
    if (!failed) setDraft("");
  }

  function rename() {
    if (!renaming) return;
    const failed = onRename(renaming.id, renaming.text.trim());
    setError(failed);
    if (!failed) setRenaming(null);
  }

  const row = (
    id: string | null,
    name: string,
    count: number,
    badge?: string,
    editable = false
  ) => {
    const active = selected === id;
    return (
      <li key={id ?? "all"} className="group">
        {renaming?.id === id && id !== null ? (
          <input
            autoFocus
            aria-label={`Rename ${name}`}
            value={renaming.text}
            onChange={(e) => setRenaming({ id, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename();
              if (e.key === "Escape") setRenaming(null);
            }}
            onBlur={() => setRenaming(null)}
            className="h-9 w-full rounded-xl bg-default px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-focus/30"
          />
        ) : (
          <div
            className={
              "flex items-center gap-1 rounded-xl pr-2 transition-colors duration-300 " +
              (active ? "bg-default-hover text-foreground" : "hover:bg-default")
            }
          >
            <button
              type="button"
              aria-current={active}
              onClick={() => onSelect(id)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {badge ? (
                <span
                  className={`rounded-xl px-1.5 py-0.5 text-xs font-semibold ${active ? "bg-default/20" : "bg-default-hover"}`}
                >
                  {badge}
                </span>
              ) : null}
            </button>
            {editable ? (
              <span className="hidden items-center group-focus-within:flex group-hover:flex">
                <button
                  type="button"
                  aria-label={`Rename ${name}`}
                  onClick={() => setRenaming({ id: id ?? "", text: name })}
                  className="rounded p-1 hover:opacity-70"
                >
                  <Icon name="ph:pencil-simple" width={13} height={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${name}`}
                  onClick={() => id && onDelete(id)}
                  className="rounded p-1 hover:opacity-70"
                >
                  <Icon name="ph:trash" width={13} height={13} />
                </button>
              </span>
            ) : null}
            <span
              className={`min-w-6 rounded-xl px-1.5 py-0.5 text-center text-xs font-semibold ${active ? "bg-default text-foreground" : "bg-default-hover"}`}
            >
              {count}
            </span>
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border" aria-label={title}>
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h3>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {row(null, "All", total)}
        {items.map((c) => row(c.id, c.name, c.count, c.badge, c.editable))}
      </ul>
      <div className="flex flex-col gap-1 border-t border-border p-2">
        <div className="flex items-center gap-1">
          <input
            aria-label="New category name"
            placeholder="New category name…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus-visible:border-focus"
          />
          <button
            type="button"
            aria-label="Add the category"
            title="Add the category"
            disabled={draft.trim() === ""}
            onClick={add}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border transition-colors duration-300 hover:bg-default disabled:opacity-40"
          >
            <Icon name="ph:plus" width={16} height={16} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="px-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
