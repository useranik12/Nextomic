"use client";

import type { ProjectSettings } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import type { PageSummary, StoredPage } from "@/server/pages";
import { CanvasFrame } from "./canvas/canvas-frame";
import { ConflictDialog } from "./conflict-dialog";
import { EditorDndProvider } from "./dnd";
import { ElementsFlyout } from "./elements-flyout";
import { LeftRail, RAIL_ITEMS, type RailItemId } from "./left-rail";
import { Navigator } from "./navigator";
import { RightPanel } from "./right-panel";
import { useEditorStore } from "./store/editor-store";
import { TopBar } from "./top-bar";
import { useAutosave } from "./use-autosave";
import { VersionHistory } from "./version-history";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function useShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const store = useEditorStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        store.redo();
      } else if (!store.selectedId) {
        return;
      } else if (mod && key === "c") {
        store.copyElement(store.selectedId);
      } else if (mod && key === "v") {
        event.preventDefault();
        store.pasteElement();
      } else if (mod && key === "d") {
        event.preventDefault();
        store.duplicateElement(store.selectedId);
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        store.removeElement(store.selectedId);
      } else if (key === "escape") {
        store.select(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function EditorShell({
  projectId,
  project,
  initialPages,
  initialPage
}: {
  projectId: string;
  project: ProjectSettings;
  initialPages: PageSummary[];
  initialPage: StoredPage;
}) {
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState(initialPages);
  const [rail, setRail] = useState<RailItemId>("navigator");
  const [collapsed, setCollapsed] = useState(false);
  const [flyout, setFlyout] = useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const { saveNow } = useAutosave();
  useShortcuts();

  // Initialise once. A later server refresh must never replace the document being edited.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const store = useEditorStore.getState();
    store.init(projectId, project);
    store.loadPage(
      { id: initialPage.id, version: initialPage.version },
      {
        name: initialPage.name,
        route: initialPage.route,
        settings: initialPage.settings,
        tree: initialPage.tree
      }
    );
    setReady(true);
  }, [projectId, project, initialPage]);

  if (!ready) {
    return (
      <div
        role="status"
        className="flex h-screen items-center justify-center bg-background text-default-500"
      >
        Loading editor…
      </div>
    );
  }

  const railLabel = RAIL_ITEMS.find((i) => i.id === rail)?.label ?? "App Settings";

  return (
    <EditorDndProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <TopBar
          projectId={projectId}
          pages={pages}
          onPagesChange={setPages}
          saveNow={saveNow}
          mode={mode}
          onModeChange={setMode}
          onOpenHistory={() => setRail("history")}
        />
        <div className="relative flex min-h-0 flex-1">
          <div
            className={`${collapsed ? "w-14" : "w-60"} shrink-0 border-r border-divider transition-[width] duration-300`}
          >
            <LeftRail
              active={rail}
              collapsed={collapsed}
              onSelect={(id) => {
                setRail(id);
                setFlyout(false);
              }}
              onToggleCollapse={() => setCollapsed((v) => !v)}
            />
          </div>
          <div className="relative w-64 shrink-0 border-r border-divider">
            {rail === "navigator" ? (
              <>
                <Navigator onOpenElements={() => setFlyout((v) => !v)} />
                {flyout ? <ElementsFlyout onClose={() => setFlyout(false)} /> : null}
              </>
            ) : rail === "history" ? (
              <VersionHistory saveNow={saveNow} />
            ) : (
              <div className="p-4">
                <h2 className="text-small font-medium">{railLabel}</h2>
                <p className="mt-2 text-small text-default-500">
                  This section is built in a later phase.
                </p>
              </div>
            )}
          </div>
          <main className="min-w-0 flex-1 bg-content1/20">
            <CanvasFrame mode={mode} />
          </main>
          <div className="w-80 shrink-0 border-l border-divider">
            <RightPanel />
          </div>
        </div>
        <ConflictDialog />
      </div>
    </EditorDndProvider>
  );
}
