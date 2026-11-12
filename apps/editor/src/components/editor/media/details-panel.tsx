"use client";

import { formatBytes, mediaEditSchema, type MediaAsset, type MediaUsage } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { mediaUsageAction } from "@/app/(builder)/editor/[id]/media-actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Busy } from "@/components/ui/busy";
import { Icon } from "@/lib/icons/Icon";
import { DraftScope } from "../draft-scope";
import { MediaThumb, mediaLabel } from "./media-thumb";
import { useTrashFlow } from "./trash-flow";
import type { MediaModel } from "./use-media";

const ROOT = "__root";

interface Draft {
  title: string;
  alt: string;
  caption: string;
  tags: string;
  folderId: string;
}

const draftOf = (a: MediaAsset): Draft => ({
  title: a.title,
  alt: a.alt,
  caption: a.caption,
  tags: a.tags.join(", "),
  folderId: a.folderId ?? ROOT
});

function Usage({ projectId, asset }: { projectId: string; asset: MediaAsset }) {
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setUsage(null);
    setFailed(false);
    void mediaUsageAction(projectId, asset.id).then((res) => {
      if (!live) return;
      if (res.data) setUsage(res.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [projectId, asset.id, asset.hash]);
  if (failed)
    return <p className="text-xs text-danger">Could not check where this file is used.</p>;
  if (!usage) return <Busy label="Checking usage" />;
  if (usage.length === 0) return <p className="text-xs text-muted">Not used anywhere yet.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {usage.map((u) => (
        <li key={`${u.kind}-${u.id}`} className="flex items-center gap-2 text-xs text-body">
          <span className="rounded-full bg-default px-2 py-0.5 capitalize text-muted">
            {u.kind}
          </span>
          <span className="truncate">{u.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** Right drawer: preview, editable details (saved as a draft), usage, replace, copy and trash. */
export function DetailsPanel({
  model,
  asset,
  onClose
}: {
  model: MediaModel;
  asset: MediaAsset;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(asset));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);
  const flow = useTrashFlow(model, onClose);

  useEffect(() => {
    setDraft(draftOf(asset));
    setError(null);
  }, [asset]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(asset));
  const set = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setError(null);
  };

  async function save(): Promise<boolean> {
    const parsed = mediaEditSchema.safeParse({
      title: draft.title,
      alt: draft.alt,
      caption: draft.caption,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      folderId: draft.folderId === ROOT ? null : draft.folderId
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details.");
      return false;
    }
    setSaving(true);
    const saved = await model.save(asset.id, parsed.data);
    setSaving(false);
    if (!saved) {
      setError(model.notice ?? "Could not save the file.");
      return false;
    }
    return true;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${asset.path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      model.setNotice("Copy is blocked by the browser. Select the path and copy it by hand.");
    }
  }

  const trashed = asset.trashedAt !== null;
  const needsAlt = asset.kind === "image" || asset.kind === "svg";

  return (
    <DraftScope
      label="Media details"
      dirty={dirty}
      onSave={save}
      onDiscard={() => setDraft(draftOf(asset))}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="truncate text-base font-semibold text-foreground">{mediaLabel(asset)}</h2>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-body hover:bg-default hover:text-foreground"
        >
          <Icon name="ph:x" width={16} height={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <MediaThumb asset={asset} fit="contain" className="aspect-video w-full rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone="secondary"
            size="sm"
            startContent={<Icon name="ph:copy" width={14} height={14} />}
            onPress={() => void copy()}
          >
            {copied ? "Copied" : "Copy URL"}
          </ActionButton>
          {trashed ? null : (
            <ActionButton
              tone="secondary"
              size="sm"
              isLoading={replacing}
              startContent={<Icon name="ph:arrows-clockwise" width={14} height={14} />}
              onPress={() => replaceInput.current?.click()}
            >
              Replace file
            </ActionButton>
          )}
          <input
            ref={replaceInput}
            type="file"
            hidden
            aria-label="Choose the replacement file"
            data-testid="media-replace-input"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setReplacing(true);
              await model.upload([file], asset.id);
              setReplacing(false);
            }}
          />
        </div>
        <FormInput
          label="Name"
          value={draft.title}
          onValueChange={(v) => set({ title: v })}
          placeholder={asset.originalName}
          maxLength={120}
          isDisabled={trashed}
        />
        <FormInput
          label="Alt text"
          value={draft.alt}
          onValueChange={(v) => set({ alt: v })}
          maxLength={300}
          isDisabled={trashed}
          description={
            needsAlt
              ? "Describes the image for screen readers. Leave empty only for decoration."
              : undefined
          }
        />
        <FormInput
          label="Caption"
          value={draft.caption}
          onValueChange={(v) => set({ caption: v })}
          maxLength={500}
          isDisabled={trashed}
        />
        <FormInput
          label="Tags"
          value={draft.tags}
          onValueChange={(v) => set({ tags: v })}
          placeholder="hero, team"
          description="Separate tags with commas."
          isDisabled={trashed}
        />
        <SelectField
          label="Folder"
          value={draft.folderId}
          onValueChange={(v) => set({ folderId: v })}
          isDisabled={trashed}
          options={[
            { value: ROOT, label: "All files (no folder)" },
            ...model.folders.map((f) => ({ value: f.id, label: f.name }))
          ]}
        />
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Type</dt>
          <dd className="text-body">{asset.mime}</dd>
          <dt className="text-muted">Size</dt>
          <dd className="text-body">{formatBytes(asset.size)}</dd>
          {asset.width && asset.height ? (
            <>
              <dt className="text-muted">Dimensions</dt>
              <dd className="text-body">
                {asset.width} × {asset.height}
              </dd>
            </>
          ) : null}
          <dt className="text-muted">Path</dt>
          <dd className="break-all text-body">{asset.path}</dd>
          <dt className="text-muted">Added</dt>
          <dd className="text-body">{new Date(asset.createdAt).toLocaleString()}</dd>
          {asset.replacedAt ? (
            <>
              <dt className="text-muted">Replaced</dt>
              <dd className="text-body">{new Date(asset.replacedAt).toLocaleString()}</dd>
            </>
          ) : null}
        </dl>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-body">Used in</h3>
          <Usage projectId={model.projectId} asset={asset} />
        </section>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        {trashed ? (
          <ActionButton tone="secondary" size="sm" onPress={() => void model.restore([asset.id])}>
            Restore
          </ActionButton>
        ) : (
          <ActionButton
            tone="danger-ghost"
            size="sm"
            startContent={<Icon name="ph:trash" width={14} height={14} />}
            isLoading={flow.busy}
            onPress={() => void flow.trash([asset.id])}
          >
            Move to trash
          </ActionButton>
        )}
        <div className="flex gap-2">
          <ActionButton
            tone="secondary"
            size="sm"
            isDisabled={!dirty || saving}
            onPress={() => {
              setDraft(draftOf(asset));
              setError(null);
            }}
          >
            Discard
          </ActionButton>
          <ActionButton
            tone="primary"
            size="sm"
            isDisabled={!dirty}
            isLoading={saving}
            onPress={() => void save()}
          >
            Save
          </ActionButton>
        </div>
      </div>
      {flow.dialog}
    </DraftScope>
  );
}
