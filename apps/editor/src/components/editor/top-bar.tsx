"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Tooltip } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";
import { getFaviconAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";
import { ActionButton } from "@/components/ui/controls";
import { BreakpointManager } from "./breakpoint-manager";
import { BreakpointGlyph } from "./icons";
import { PageMenu } from "./page-menu";
import { PageSettingsModal } from "./page-settings-modal";
import { breakpointHasStyles, useEditorStore, type SaveStatus } from "./store/editor-store";
import type { PageSummary } from "@/server/pages";

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
  conflict: "Conflict"
};
const STATUS_DOT: Record<SaveStatus, string> = {
  saved: "bg-success",
  dirty: "bg-warning",
  saving: "bg-primary animate-pulse",
  error: "bg-danger",
  conflict: "bg-danger"
};

function SaveChip({ saveNow }: { saveNow: () => Promise<void> }) {
  const doc = useEditorStore((s) => s.doc);
  const status = useEditorStore((s) => s.saveStatus);
  const error = useEditorStore((s) => s.saveError);
  return (
    <div className="flex items-center gap-2 rounded-full bg-default-100 px-3 py-1.5 text-small">
      <span className="text-default-500">Page</span>
      <span className="max-w-[160px] truncate font-medium text-foreground">{doc?.name}</span>
      <span className="text-default-400">{doc?.route}</span>
      <span role="status" className="flex items-center gap-1.5 text-tiny text-default-600">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        {error && status === "error" ? error : STATUS_LABEL[status]}
      </span>
      {status === "error" ? (
        <ActionButton size="sm" tone="ghost" onPress={() => void saveNow()}>
          Retry
        </ActionButton>
      ) : null}
    </div>
  );
}

function UndoRedo() {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const cls =
    "rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center">
      <button type="button" aria-label="Undo" disabled={!canUndo} onClick={undo} className={cls}>
        <Icon name="ph:arrow-counter-clockwise" width={20} height={20} />
      </button>
      <button type="button" aria-label="Redo" disabled={!canRedo} onClick={redo} className={cls}>
        <Icon name="ph:arrow-clockwise" width={20} height={20} />
      </button>
    </div>
  );
}

function BreakpointSwitcher({ onManage }: { onManage: () => void }) {
  const breakpoints = useEditorStore((s) => s.project.breakpoints);
  const activeId = useEditorStore((s) => s.activeBreakpointId);
  const setActive = useEditorStore((s) => s.setActiveBreakpoint);
  const doc = useEditorStore((s) => s.doc);
  return (
    <div className="flex items-center gap-1">
      <div
        role="group"
        aria-label="Breakpoints"
        className="flex items-center gap-1 rounded-full bg-default-100 p-1"
      >
        {breakpoints.map((bp) => {
          const active = bp.id === activeId;
          const dot = breakpointHasStyles(doc, bp.id);
          return (
            <Tooltip
              key={bp.id}
              content={`${bp.name}${bp.width ? ` (${bp.kind === "down" ? "≤" : "≥"} ${bp.width}px)` : ""}`}
            >
              <button
                type="button"
                aria-label={bp.name}
                aria-pressed={active}
                onClick={() => setActive(bp.id)}
                className={
                  "relative flex h-9 w-12 items-center justify-center rounded-full transition-colors duration-300 " +
                  (active
                    ? "bg-default-300 text-foreground"
                    : "text-default-600 hover:bg-default-200")
                }
              >
                <BreakpointGlyph icon={bp.icon} />
                {dot ? (
                  <span
                    aria-label="Has changes"
                    className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-warning"
                  />
                ) : null}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Manage breakpoints"
        onClick={onManage}
        className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
      >
        <Icon name="ph:dots-three-vertical" width={20} height={20} />
      </button>
    </div>
  );
}

export function TopBar({
  projectId,
  pages,
  onPagesChange,
  saveNow,
  mode,
  onModeChange,
  onOpenHistory
}: {
  projectId: string;
  pages: PageSummary[];
  onPagesChange: (pages: PageSummary[]) => void;
  saveNow: () => Promise<void>;
  mode: "light" | "dark";
  onModeChange: (mode: "light" | "dark") => void;
  onOpenHistory: () => void;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pageId = useEditorStore((s) => s.page?.id);
  const status = useEditorStore((s) => s.saveStatus);
  const route = useEditorStore((s) => s.doc?.route ?? "/");

  function confirmLeave(event: React.MouseEvent) {
    if (
      (status === "dirty" || status === "saving") &&
      !window.confirm("You have unsaved changes. Leave anyway?")
    ) {
      event.preventDefault();
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider bg-background px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/projects"
          aria-label="Back to All Projects"
          onClick={confirmLeave}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-medium bg-white"
        >
          <img src={getFaviconAsset("svg")} alt="" width={36} height={36} />
        </Link>
        <PageMenu pages={pages} onPagesChange={onPagesChange} saveNow={saveNow} />
        <button
          type="button"
          aria-label="Page settings"
          onClick={() => setSettingsOpen(true)}
          className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
        >
          <Icon name="ph:sliders-horizontal" width={20} height={20} />
        </button>
        <button
          type="button"
          aria-label={
            mode === "dark" ? "Preview the site in light mode" : "Preview the site in dark mode"
          }
          onClick={() => onModeChange(mode === "dark" ? "light" : "dark")}
          className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
        >
          {mode === "dark" ? (
            <Icon name="ph:moon" width={20} height={20} />
          ) : (
            <Icon name="ph:sun" width={20} height={20} />
          )}
        </button>
        <UndoRedo />
        <div className="hidden min-w-0 lg:block">
          <SaveChip saveNow={saveNow} />
        </div>
      </div>

      <BreakpointSwitcher onManage={() => setManagerOpen(true)} />

      <div className="flex items-center gap-2">
        <Tooltip content="Open the published page (publish the project first)">
          <span>
            <button
              type="button"
              aria-label="View published page"
              disabled
              className="rounded-full p-2 text-default-400"
            >
              <Icon name="ph:arrow-square-out" width={20} height={20} />
            </button>
          </span>
        </Tooltip>
        <Dropdown>
          <DropdownTrigger>
            <ActionButton endContent={<Icon name="ph:caret-down" width={14} height={14} />}>
              Publish
            </ActionButton>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Publish menu"
            onAction={(key) => {
              if (key === "save") void saveNow();
              if (key === "preview")
                window.open(
                  `/preview/${projectId}?path=${encodeURIComponent(route)}`,
                  "_blank",
                  "noopener"
                );
              if (key === "history") onOpenHistory();
            }}
          >
            <DropdownItem key="save" description="Stores a version snapshot of the draft">
              Save
            </DropdownItem>
            <DropdownItem key="preview" description="Opens the saved draft in a new tab">
              Preview draft
            </DropdownItem>
            <DropdownItem key="history">Version history</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      {managerOpen ? <BreakpointManager isOpen onClose={() => setManagerOpen(false)} /> : null}
      {settingsOpen && pageId ? (
        <PageSettingsModal
          pages={pages}
          onPagesChange={onPagesChange}
          saveNow={saveNow}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </header>
  );
}
