"use client";

import type { AnimationFolder, Timeline } from "@nextomic/schema";
import { useRef, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { downloadText, exportAnimations, parseAnimationImport } from "./animation-io";
import { animationActions, useAnimationSettings } from "./use-animations";

function IconButton({
  label,
  icon,
  onClick,
  danger
}: {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "rounded p-1 text-default-500 outline-none focus-visible:ring-2 focus-visible:ring-default-800/40 " +
        (danger ? "hover:text-danger" : "hover:text-foreground")
      }
    >
      <Icon name={icon} width={14} height={14} />
    </button>
  );
}

function TimelineRow({
  timeline,
  selected,
  onSelect,
  onRemoved
}: {
  timeline: Timeline;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemoved: () => void;
}) {
  return (
    <li
      className={
        "group flex items-center gap-1 rounded-medium pr-1 " +
        (selected ? "bg-default-200" : "hover:bg-default-100")
      }
    >
      <button
        type="button"
        onClick={() => onSelect(timeline.id)}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/40"
      >
        <Icon name="ph:timer" width={14} height={14} className="shrink-0 text-default-500" />
        <span className={"truncate " + (timeline.enabled ? "" : "text-default-400 line-through")}>
          {timeline.name}
        </span>
        <span className="ml-auto shrink-0 text-tiny text-default-400">
          {timeline.animations.length}
        </span>
      </button>
      <IconButton
        label={timeline.enabled ? `Turn off ${timeline.name}` : `Turn on ${timeline.name}`}
        icon={timeline.enabled ? "ph:eye" : "ph:eye-slash"}
        onClick={() => animationActions.patchTimeline(timeline.id, { enabled: !timeline.enabled })}
      />
      <IconButton
        label={`Duplicate ${timeline.name}`}
        icon="ph:copy"
        onClick={() => {
          const copy = animationActions.duplicateTimeline(timeline.id);
          if (copy) onSelect(copy.id);
        }}
      />
      <IconButton
        label={`Delete ${timeline.name}`}
        icon="ph:trash"
        danger
        onClick={() => {
          animationActions.removeTimeline(timeline.id);
          onRemoved();
        }}
      />
    </li>
  );
}

function FolderHeader({ folder }: { folder: AnimationFolder }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  function commit() {
    animationActions.renameFolder(folder.id, name);
    setEditing(false);
  }
  return (
    <div className="flex items-center gap-1 px-1 pt-2 text-tiny font-semibold uppercase tracking-wide text-default-500">
      <Icon name="ph:folder" width={14} height={14} />
      {editing ? (
        <input
          autoFocus
          aria-label="Folder name"
          value={name}
          maxLength={48}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded bg-default-100 px-1.5 py-0.5 text-small normal-case text-foreground outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
      )}
      <IconButton
        label={`Rename ${folder.name}`}
        icon="ph:pencil-simple"
        onClick={() => {
          setName(folder.name);
          setEditing(true);
        }}
      />
      <IconButton
        label={`Delete folder ${folder.name}. Its timelines move out of it.`}
        icon="ph:trash"
        danger
        onClick={() => animationActions.removeFolder(folder.id)}
      />
    </div>
  );
}

/** Folders and timelines, plus new, import and export. */
export function TimelinesSidebar({
  selectedId,
  onSelect
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const settings = useAnimationSettings();
  const showToast = useEditorStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onImport(file: File | undefined) {
    if (!file) return;
    const result = parseAnimationImport(await file.text());
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    animationActions.replaceAll({
      folders: [...settings.folders, ...result.settings.folders],
      timelines: [...settings.timelines, ...result.settings.timelines]
    });
    showToast(`Imported ${result.settings.timelines.length} timeline(s)`);
    onSelect(result.settings.timelines[0]?.id ?? selectedId);
  }

  const loose = settings.timelines.filter(
    (t) => !t.folderId || !settings.folders.some((f) => f.id === t.folderId)
  );

  const row = (t: Timeline) => (
    <TimelineRow
      key={t.id}
      timeline={t}
      selected={t.id === selectedId}
      onSelect={onSelect}
      onRemoved={() => t.id === selectedId && onSelect(null)}
    />
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-divider bg-content1">
      <div className="flex items-center gap-1.5 px-4 pb-2 pt-3 text-small font-semibold">
        Timelines
        <InfoTip
          text="A timeline is a sequence of animations that plays together on one trigger, like scrolling to a section or clicking a button. Keep related timelines in folders."
          label="Timelines"
        />
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        <ActionButton size="sm" onPress={() => onSelect(animationActions.addTimeline(null).id)}>
          <Icon name="ph:plus" width={14} height={14} />
          New timeline
        </ActionButton>
        <ActionButton size="sm" tone="ghost" onPress={() => animationActions.addFolder()}>
          <Icon name="ph:folder-plus" width={14} height={14} />
          Folder
        </ActionButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {settings.timelines.length === 0 && settings.folders.length === 0 ? (
          <p className="px-1 text-small text-default-500">
            No timelines yet. Create one, then add animations to it.
          </p>
        ) : null}
        {settings.folders.map((folder) => (
          <div key={folder.id}>
            <FolderHeader folder={folder} />
            <ul className="flex flex-col gap-0.5 pl-2">
              {settings.timelines.filter((t) => t.folderId === folder.id).map(row)}
              <li>
                <button
                  type="button"
                  onClick={() => onSelect(animationActions.addTimeline(folder.id).id)}
                  className="px-2.5 py-1 text-tiny text-default-500 hover:text-foreground"
                >
                  + Add timeline here
                </button>
              </li>
            </ul>
          </div>
        ))}
        {loose.length > 0 ? <ul className="mt-2 flex flex-col gap-0.5">{loose.map(row)}</ul> : null}
      </div>
      <div className="flex items-center gap-2 border-t border-divider px-3 py-2.5">
        <ActionButton size="sm" tone="ghost" onPress={() => fileRef.current?.click()}>
          <Icon name="ph:upload-simple" width={14} height={14} />
          Import
        </ActionButton>
        <ActionButton
          size="sm"
          tone="ghost"
          isDisabled={settings.timelines.length === 0}
          onPress={() => downloadText("nextomic-animations.json", exportAnimations(settings))}
        >
          <Icon name="ph:download-simple" width={14} height={14} />
          Export
        </ActionButton>
        <InfoTip
          text="Export saves all timelines and folders to a JSON file. Import adds the timelines from such a file to this project; nothing already here is replaced."
          label="Import and export"
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Animations file to import"
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </aside>
  );
}
