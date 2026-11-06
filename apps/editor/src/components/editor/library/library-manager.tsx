"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePageAction, duplicatePageAction } from "@/app/(builder)/editor/[id]/actions";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  listLibraryAction,
  setLiveAction
} from "@/app/(builder)/editor/[id]/library-actions";
import type { LibraryItem } from "@/server/library";
import { NewPageModal } from "../page-menu";
import { useEditorStore } from "../store/editor-store";
import { DEFAULT_QUERY, filterLibrary, type LibraryQuery } from "./library-filter";
import { LibraryGrid, LibraryTable } from "./library-views";
import { ActionIcons, type RowAction } from "./library-parts";
import { LibraryToolbar, type LibraryView } from "./library-toolbar";
import { NewTemplateModal } from "./new-template-modal";
import { generateScreenshot, useScreenshotQueue } from "./screenshots";

const VIEW_KEY = "nxt:library-view";

function readView(): LibraryView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/**
 * Pages & Templates: every page and template of the project in one place, as cards with a
 * screenshot or as rows. The canvas is hidden while this is open.
 */
export function LibraryManager({
  projectId,
  onOpen,
  onDeleted,
  onChanged
}: {
  projectId: string;
  onOpen: (item: LibraryItem) => void | Promise<void>;
  onDeleted: (item: LibraryItem) => void | Promise<void>;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState<LibraryQuery>(DEFAULT_QUERY);
  const [view, setView] = useState<LibraryView>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const taxonomy = useEditorStore((s) => s.project.taxonomy);
  const screenshots = useEditorStore((s) => s.project.generateScreenshots);

  const reload = useCallback(async () => {
    const result = await listLibraryAction(projectId);
    if (result.error !== null) {
      setLoadError(result.error);
      return;
    }
    setLoadError(null);
    setItems(result.data);
  }, [projectId]);

  useEffect(() => {
    setView(readView());
    void reload();
  }, [reload]);

  const queue = useScreenshotQueue(projectId, items ?? [], screenshots, reload);
  const shown = useMemo(() => filterLibrary(items ?? [], query), [items, query]);
  const counts = useMemo(
    () => ({
      pages: (items ?? []).filter((i) => i.kind === "page").length,
      templates: (items ?? []).filter((i) => i.kind === "template").length
    }),
    [items]
  );
  const selected = shown.find((i) => i.id === selectedId) ?? null;

  function changeView(next: LibraryView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The choice then lasts for this visit only.
    }
  }

  async function act(item: LibraryItem, action: RowAction) {
    if (action === "edit") return void onOpen(item);
    if (action === "delete" && !window.confirm(`Delete "${item.name}"? This cannot be undone.`))
      return;
    setWorking(true);
    setMessage(null);
    let error: string | null = null;
    if (action === "status") {
      error = (await setLiveAction(projectId, item.kind, item.id, !item.live)).error;
    } else if (action === "duplicate") {
      error = (
        item.kind === "page"
          ? await duplicatePageAction(projectId, item.id)
          : await duplicateTemplateAction(projectId, item.id)
      ).error;
    } else if (action === "screenshot") {
      try {
        await generateScreenshot(projectId, item);
      } catch (e) {
        error = e instanceof Error ? e.message : "Could not make the screenshot.";
      }
    } else if (action === "delete") {
      error = (
        item.kind === "page"
          ? await deletePageAction(projectId, item.id)
          : await deleteTemplateAction(projectId, item.id)
      ).error;
      if (error === null) {
        if (selectedId === item.id) setSelectedId(null);
        await onDeleted(item);
      }
    }
    setWorking(false);
    if (error !== null) setMessage(error);
    await reload();
    onChanged();
  }

  const body = (() => {
    if (loadError) {
      return (
        <div role="alert" className="flex flex-col items-start gap-2 p-6 text-small text-danger">
          {loadError}
          <button type="button" onClick={() => void reload()} className="underline">
            Try again
          </button>
        </div>
      );
    }
    if (items === null) {
      return (
        <p role="status" className="p-6 text-small text-default-500">
          Loading…
        </p>
      );
    }
    if (shown.length === 0) {
      return (
        <p role="status" className="p-6 text-small text-default-500">
          {(query.tab === "pages" ? counts.pages : counts.templates) === 0
            ? `No ${query.tab} yet. Use the New button to make one.`
            : `No ${query.tab} match these filters.`}
        </p>
      );
    }
    const props = {
      projectId,
      items: shown,
      selectedId,
      onSelect: setSelectedId,
      onOpen: (item: LibraryItem) => void onOpen(item),
      onAction: (item: LibraryItem, action: RowAction) => void act(item, action)
    };
    return view === "grid" ? <LibraryGrid {...props} /> : <LibraryTable {...props} />;
  })();

  return (
    <section
      aria-label="Pages and templates"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <LibraryToolbar
        query={query}
        onQuery={(change) => setQuery((q) => ({ ...q, ...change }))}
        view={view}
        onView={changeView}
        taxonomy={taxonomy}
        counts={counts}
        onCreate={() => setCreating(true)}
      />
      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-divider px-4 text-tiny text-default-500">
        <span role="status">
          {shown.length} shown
          {screenshots && queue.busy ? " · Making screenshots…" : ""}
          {screenshots && queue.failed > 0 ? ` · ${queue.failed} screenshot(s) failed` : ""}
          {message ? <span className="ml-2 text-danger">{message}</span> : null}
        </span>
        {selected && view === "list" ? (
          <ActionIcons item={selected} disabled={working} onAction={(a) => void act(selected, a)} />
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{body}</div>
      {creating && query.tab === "pages" ? (
        <NewPageModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            await reload();
            onChanged();
          }}
        />
      ) : null}
      {creating && query.tab === "templates" ? (
        <NewTemplateModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            await reload();
            onChanged();
          }}
        />
      ) : null}
    </section>
  );
}
