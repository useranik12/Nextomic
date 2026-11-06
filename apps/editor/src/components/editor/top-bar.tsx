"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Tooltip } from "@heroui/react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  getPublishStateAction,
  publishAction,
  unpublishAction
} from "@/app/(builder)/editor/[id]/actions";
import { getBrandAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";
import { ActionButton } from "@/components/ui/controls";
import { EditorClock } from "./editor-clock";
import { BreakpointManager } from "./breakpoint-manager";
import { BreakpointGlyph } from "./icons";
import { PageMenu } from "./page-menu";
import { PageSettingsModal } from "./page-settings-modal";
import {
  breakpointHasStyles,
  unsavedDraftLabels,
  useEditorStore,
  type SaveStatus
} from "./store/editor-store";
import { themeModeFor, useResolvedTheme } from "./store/use-resolved-theme";
import { themeModes } from "@nextomic/schema";
import { UnsavedDraftsDialog } from "./unsaved-drafts-dialog";
import type { PageSummary } from "@/server/pages";

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
  conflict: "Conflict"
};
export const STATUS_DOT: Record<SaveStatus, string> = {
  saved: "bg-success",
  dirty: "bg-warning",
  saving: "bg-default-400 animate-pulse",
  error: "bg-danger",
  conflict: "bg-danger"
};

function ChipFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-default-500">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

// What applies to this page right now. Theme, header and footer arrive with themes and templates.
function ChipPopover({ status }: { status: SaveStatus }) {
  const doc = useEditorStore((s) => s.doc);
  const publishedAt = useEditorStore((s) => s.publishedAt);
  const version = useEditorStore((s) => s.page?.version);
  return (
    <div className="flex flex-col gap-2 px-1 py-2 text-small">
      <p className="font-medium text-foreground">{doc?.name}</p>
      <dl className="flex flex-col gap-1">
        <ChipFact label="Route" value={doc?.route ?? ""} />
        <ChipFact label="Version" value={version ? String(version) : "—"} />
        <ChipFact
          label="Status"
          value={(publishedAt ? "Published" : "Draft") + " · " + STATUS_LABEL[status]}
        />
        <ChipFact label="Theme" value="None" />
        <ChipFact label="Header" value="None" />
        <ChipFact label="Footer" value="None" />
      </dl>
    </div>
  );
}

function SaveChip({ saveNow }: { saveNow: () => Promise<void> }) {
  const doc = useEditorStore((s) => s.doc);
  const status = useEditorStore((s) => s.saveStatus);
  const error = useEditorStore((s) => s.saveError);
  return (
    <Tooltip content={<ChipPopover status={status} />} placement="bottom" delay={300}>
      <div
        tabIndex={0}
        aria-label="Editing context"
        className="flex items-center gap-2 rounded-full bg-default-100 px-3 py-1.5 text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/30"
      >
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
    </Tooltip>
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
  const status = useEditorStore((s) => s.saveStatus);
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
                    aria-label={`Has changes: ${STATUS_LABEL[status]}`}
                    className={`absolute right-2 top-1.5 h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
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

// Publish and the arrow are one joined control. Publish puts the saved pages live for everyone;
// the arrow holds Save, Unpublish and the draft tools. Drafts are only visible to signed-in members.
function PublishControl({
  projectId,
  saveNow,
  onOpenHistory
}: {
  projectId: string;
  saveNow: () => Promise<void>;
  onOpenHistory: () => void;
}) {
  const publishedAt = useEditorStore((s) => s.publishedAt);
  const showClock = useEditorStore((s) => s.project.showClock);
  const setPublishedAt = useEditorStore((s) => s.setPublishedAt);
  const route = useEditorStore((s) => s.doc?.route ?? "/");
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [unsaved, setUnsaved] = useState<string[] | null>(null);
  const [hasChanges, setHasChanges] = useState(true);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const savedTick = useEditorStore((s) => s.savedTick);
  const breakpoints = useEditorStore((s) => s.project.breakpoints);

  // The server compares the saved draft with what is live; refresh after every save.
  useEffect(() => {
    void getPublishStateAction(projectId).then((result) => {
      if (result.error !== null) return;
      setPublishedAt(result.data.publishedAt);
      setHasChanges(result.data.hasUnpublishedChanges);
    });
  }, [projectId, setPublishedAt, savedTick, breakpoints]);

  const upToDate = publishedAt !== null && !hasChanges && saveStatus === "saved";
  // Red: edits since the last save. Orange: saved as a draft, not live. Green: live and current.
  const dot =
    saveStatus === "dirty" || saveStatus === "error" || saveStatus === "conflict"
      ? { color: "bg-danger", label: "Unsaved changes" }
      : saveStatus === "saving"
        ? { color: "bg-orange-500 animate-pulse", label: "Saving" }
        : upToDate
          ? { color: "bg-success", label: "Published" }
          : { color: "bg-orange-500", label: "Draft saved, not published" };

  // Publishing waits until every edited group is saved with its check icon (or discarded).
  function requestPublish() {
    const { pageDrafts, doc } = useEditorStore.getState();
    const labels = unsavedDraftLabels(pageDrafts, doc?.settings);
    if (labels.length > 0) setUnsaved(labels);
    else void run("publish");
  }

  async function run(kind: "publish" | "unpublish") {
    setBusy(kind);
    setMessage(null);
    if (kind === "publish") await saveNow();
    const result =
      kind === "publish" ? await publishAction(projectId) : await unpublishAction(projectId);
    setBusy(null);
    if (result.error !== null) {
      setMessage({ text: result.error, tone: "error" });
      return;
    }
    setPublishedAt(result.data.publishedAt);
    setHasChanges(result.data.hasUnpublishedChanges);
    setMessage({ text: kind === "publish" ? "Published" : "Unpublished", tone: "ok" });
    window.setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="flex items-center gap-2">
      {unsaved ? (
        <UnsavedDraftsDialog
          labels={unsaved}
          onCancel={() => setUnsaved(null)}
          onDiscard={() => {
            useEditorStore.getState().clearPageDrafts();
            setUnsaved(null);
            void run("publish");
          }}
        />
      ) : null}
      {message ? (
        <span
          role="status"
          className={`text-tiny ${message.tone === "error" ? "text-danger" : "text-success"}`}
        >
          {message.text}
        </span>
      ) : null}
      {showClock ? <EditorClock /> : null}
      <Tooltip
        content={
          publishedAt
            ? "Open the published page"
            : "Not published yet. Only published pages are public."
        }
      >
        <span>
          <button
            type="button"
            aria-label="View published page"
            disabled={!publishedAt}
            onClick={() =>
              window.open(`/site/${projectId}${route === "/" ? "" : route}`, "_blank", "noopener")
            }
            className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground disabled:text-default-300 disabled:hover:bg-transparent"
          >
            <Icon name="ph:arrow-square-out" width={20} height={20} />
          </button>
        </span>
      </Tooltip>
      <div className="relative flex items-center">
        <span
          role="img"
          aria-label={dot.label}
          title={dot.label}
          className={`pointer-events-none absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 rounded-full ring-2 ring-background ${dot.color}`}
        />
        <ActionButton
          className="rounded-r-none"
          isLoading={busy === "publish"}
          isDisabled={busy !== null || upToDate}
          onPress={requestPublish}
        >
          {upToDate ? "Published" : "Publish"}
        </ActionButton>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <ActionButton
              isIconOnly
              aria-label="More publish options"
              className="w-9 rounded-l-none border-l border-default-50/20 px-0"
              isDisabled={busy === "publish"}
            >
              <Icon name="ph:caret-down" width={14} height={14} />
            </ActionButton>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Publish menu"
            disabledKeys={publishedAt ? [] : ["unpublish"]}
            onAction={(key) => {
              if (key === "save") void saveNow();
              if (key === "unpublish") void run("unpublish");
              if (key === "preview")
                window.open(
                  `/preview/${projectId}?path=${encodeURIComponent(route)}`,
                  "_blank",
                  "noopener"
                );
              if (key === "history") onOpenHistory();
            }}
          >
            <DropdownItem
              key="save"
              description="Saves the draft (Ctrl+S). Only signed-in members see it"
            >
              Save
            </DropdownItem>
            <DropdownItem key="preview" description="Opens the saved draft in a new tab">
              Preview draft
            </DropdownItem>
            <DropdownItem key="history">Version history</DropdownItem>
            <DropdownItem
              key="unpublish"
              color="danger"
              className="text-danger"
              description="Takes the site offline for everyone"
            >
              Unpublish
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  );
}

/** Previews a color mode: a sun/moon switch for two modes, a menu when the theme has more. */
function ModePreview({
  mode,
  onModeChange
}: {
  mode: string;
  onModeChange: (mode: string) => void;
}) {
  const theme = useResolvedTheme();
  const modes = theme
    ? themeModes(theme)
    : [
        { id: "light", name: "Light" },
        { id: "dark", name: "Dark" }
      ];
  const current = themeModeFor(theme, mode);
  const button =
    "rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground";
  if (modes.length <= 1) return null;
  if (modes.length === 2) {
    const dark = current === "dark";
    return (
      <button
        type="button"
        aria-label={dark ? "Preview the site in light mode" : "Preview the site in dark mode"}
        onClick={() => onModeChange(dark ? "light" : "dark")}
        className={button}
      >
        {dark ? (
          <Icon name="ph:moon" width={20} height={20} />
        ) : (
          <Icon name="ph:sun" width={20} height={20} />
        )}
      </button>
    );
  }
  return (
    <Dropdown>
      <DropdownTrigger>
        <button type="button" aria-label="Preview a color mode" className={button}>
          <Icon name="ph:circle-half" width={20} height={20} />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Color modes"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([current])}
        onAction={(key) => onModeChange(String(key))}
      >
        {modes.map((m) => (
          <DropdownItem key={m.id}>{m.name}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
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
  mode: string;
  onModeChange: (mode: string) => void;
  onOpenHistory: () => void;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pageId = useEditorStore((s) => s.page?.id);
  const status = useEditorStore((s) => s.saveStatus);

  function confirmLeave(event: React.MouseEvent) {
    if (
      (status === "dirty" || status === "saving") &&
      !window.confirm("You have unsaved changes. Leave anyway?")
    ) {
      event.preventDefault();
    }
  }

  return (
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-divider bg-background px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/projects"
          aria-label="Back to All Projects"
          onClick={confirmLeave}
          className="flex h-9 w-9 items-center justify-center"
        >
          <Image
            src={getBrandAsset("mascot", "light")}
            alt=""
            width={32}
            height={32}
            priority
            className="hidden dark:block"
          />
          <Image
            src={getBrandAsset("mascot", "dark")}
            alt=""
            width={32}
            height={32}
            priority
            className="dark:hidden"
          />
        </Link>
        <PageMenu pages={pages} onPagesChange={onPagesChange} />
        <button
          type="button"
          aria-label="Page settings"
          onClick={() => setSettingsOpen(true)}
          className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
        >
          <Icon name="ph:sliders-horizontal" width={20} height={20} />
        </button>
        <ModePreview mode={mode} onModeChange={onModeChange} />
        <UndoRedo />
        <div className="hidden min-w-0 xl:block">
          <SaveChip saveNow={saveNow} />
        </div>
      </div>

      <BreakpointSwitcher onManage={() => setManagerOpen(true)} />

      <div className="flex justify-end">
        <PublishControl projectId={projectId} saveNow={saveNow} onOpenHistory={onOpenHistory} />
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
