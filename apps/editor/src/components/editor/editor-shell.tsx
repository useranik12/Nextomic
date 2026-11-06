"use client";

import type { ProjectSettings } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { listPagesAction } from "@/app/(builder)/editor/[id]/actions";
import type { PageSummary, StoredPage } from "@/server/pages";
import { CanvasFrame } from "./canvas/canvas-frame";
import { AppSettings } from "./app-settings";
import { OPEN_DESIGN_SYSTEM_EVENT } from "./right-panel/font-picker";
import { DesignSystemModal } from "./design-system/design-system-modal";
import { ConflictDialog } from "./conflict-dialog";
import { EditorDndProvider } from "./dnd";
import { ElementContextMenu } from "./element-context-menu";
import { ElementsFlyout } from "./elements-flyout";
import { LeftRail, RAIL_ITEMS, type RailItemId } from "./left-rail";
import { Navigator } from "./navigator";
import { PanelResizer, usePanelWidth } from "./panel-resizer";
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

const LEFT_PANEL_WIDTH = 240;
const NAVIGATOR_MIN = 240;
const RIGHT_MIN = 288;

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
  const navigatorWidth = usePanelWidth("nxt:navigator-width", NAVIGATOR_MIN, NAVIGATOR_MIN);
  const rightWidth = usePanelWidth("nxt:right-panel-width", RIGHT_MIN, RIGHT_MIN);
  const [pages, setPages] = useState(initialPages);
  const [rail, setRail] = useState<RailItemId>("navigator");
  const [designSystemOpen, setDesignSystemOpen] = useState(false);
  const [designSystemTab, setDesignSystemTab] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState(false);
  const [flyout, setFlyout] = useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const { saveNow } = useAutosave();

  // The font picker in Design asks for the Design System on its Fonts tab.
  useEffect(() => {
    function open(event: Event) {
      setDesignSystemTab(event instanceof CustomEvent ? String(event.detail) : undefined);
      setDesignSystemOpen(true);
    }
    window.addEventListener(OPEN_DESIGN_SYSTEM_EVENT, open);
    return () => window.removeEventListener(OPEN_DESIGN_SYSTEM_EVENT, open);
  }, []);
  const selectedId = useEditorStore((s) => s.selectedId);
  useShortcuts();

  // Initialise once. A later server refresh must never replace the document being edited.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    setCollapsed(true);
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

  // One left panel at a time: with the Navigator open the section rail is folded to its icons, and
  // selecting an element closes the Elements popup (an insert selects the new element). Other
  // sections keep the rail as the user left it.
  useEffect(() => {
    if (!selectedId) return;
    if (rail === "navigator") setCollapsed(true);
    setFlyout(false);
  }, [selectedId, rail]);

  // Keep the page list (names, routes, home flag) in step with saves.
  const savedTick = useEditorStore((s) => s.savedTick);
  useEffect(() => {
    if (savedTick === 0) return;
    void listPagesAction(projectId).then((result) => {
      if (result.error === null) setPages(result.data);
    });
  }, [savedTick, projectId]);

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
            className={`${collapsed ? "w-14" : "w-52"} shrink-0 border-r border-divider transition-[width] duration-300`}
          >
            <LeftRail
              active={rail}
              collapsed={collapsed}
              onSelect={(id) => {
                if (id === "design-system") {
                  setDesignSystemTab(undefined);
                  setDesignSystemOpen(true);
                  return;
                }
                setRail(id);
                setFlyout(false);
                // The Navigator folds the rail and shows the page settings until an element is picked.
                if (id === "navigator") {
                  setCollapsed(true);
                  useEditorStore.getState().select(null);
                }
              }}
              onToggleCollapse={() => setCollapsed((v) => !v)}
            />
          </div>
          <div
            className="relative shrink-0 border-r border-divider"
            style={{ width: rail === "navigator" ? navigatorWidth.width : LEFT_PANEL_WIDTH }}
          >
            {rail === "navigator" ? (
              <PanelResizer
                side="left"
                label="Resize the Navigator"
                width={navigatorWidth.width}
                min={NAVIGATOR_MIN}
                onResize={navigatorWidth.setWidth}
              />
            ) : null}
            {rail === "navigator" ? (
              <>
                <Navigator onOpenElements={() => setFlyout((v) => !v)} />
                {flyout ? <ElementsFlyout onClose={() => setFlyout(false)} /> : null}
              </>
            ) : rail === "history" ? (
              <VersionHistory saveNow={saveNow} />
            ) : rail === "app-settings" ? (
              <AppSettings />
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
          <div
            className="relative shrink-0 border-l border-divider"
            style={{ width: rightWidth.width }}
          >
            <PanelResizer
              side="right"
              label="Resize the settings panel"
              width={rightWidth.width}
              min={RIGHT_MIN}
              onResize={rightWidth.setWidth}
            />
            <RightPanel />
          </div>
        </div>
        <ConflictDialog />
        <ElementContextMenu />
        {designSystemOpen ? (
          <DesignSystemModal
            initialTab={designSystemTab}
            onClose={() => setDesignSystemOpen(false)}
            saveNow={saveNow}
            pages={pages}
          />
        ) : null}
      </div>
    </EditorDndProvider>
  );
}
