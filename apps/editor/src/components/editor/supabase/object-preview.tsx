"use client";

import { Spinner } from "@heroui-v2/react";
import type { StorageEntry } from "@nextomic/integrations";
import { useEffect, useState } from "react";
import { signSupabaseObjectAction } from "@/app/(builder)/editor/[id]/connector-actions";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { CHIP_CLASSES, extensionOf, formatBytes, objectKind, type ObjectKind } from "./object-kind";

/** The URL to show: the public URL, or a short-lived signed URL for a private bucket. */
function useObjectUrl(
  projectId: string,
  connectorId: string,
  bucket: string,
  path: string,
  publicUrl: string | null
) {
  const [signed, setSigned] = useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null
  });
  useEffect(() => {
    if (publicUrl) return;
    let stale = false;
    setSigned({ url: null, error: null });
    void signSupabaseObjectAction(projectId, connectorId, bucket, path).then((result) => {
      if (!stale) setSigned({ url: result.data, error: result.error });
    });
    return () => {
      stale = true;
    };
  }, [projectId, connectorId, bucket, path, publicUrl]);
  return publicUrl ? { url: publicUrl, error: null } : signed;
}

function PreviewBody({ kind, url, name }: { kind: ObjectKind; url: string; name: string }) {
  // An SVG shown through <img> never runs its scripts.
  if (kind === "image" || kind === "svg")
    return <img src={url} alt={name} className="max-h-full max-w-full object-contain" />;
  if (kind === "video")
    return (
      <video src={url} controls className="max-h-full w-full" aria-label={name}>
        <track kind="captions" />
      </video>
    );
  if (kind === "audio") return <audio src={url} controls className="w-full" aria-label={name} />;
  return <p className="text-small text-default-500">Preview not available</p>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-tiny text-default-500">{label}</dt>
      <dd className="break-all text-small text-foreground">{value}</dd>
    </div>
  );
}

/** Right-hand preview of one file: URL, type chip, preview, details and Copy URL. */
export function ObjectPreview({
  projectId,
  connectorId,
  bucket,
  path,
  entry,
  publicUrl,
  onClose
}: {
  projectId: string;
  connectorId: string;
  bucket: string;
  path: string;
  entry: StorageEntry;
  publicUrl: string | null;
  onClose: () => void;
}) {
  const kind = objectKind(entry.name, entry.mimeType);
  const { url, error } = useObjectUrl(projectId, connectorId, bucket, path, publicUrl);
  const [copied, setCopied] = useState(false);
  const label = (extensionOf(entry.name) || entry.mimeType?.split("/")[1] || "file").toUpperCase();

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <aside
      aria-label={`Preview of ${entry.name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="flex h-full w-[350px] min-w-[350px] max-w-[350px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-divider pl-4"
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-tiny text-default-500" title={url ?? undefined}>
          {url ?? (error ? "No URL" : "Signing URL…")}
        </p>
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-default-600 hover:bg-default-100 hover:text-foreground"
        >
          <Icon name="ph:x" width={16} height={16} />
        </button>
      </div>
      <span
        className={`w-fit rounded-full px-2 py-0.5 text-tiny font-medium ${CHIP_CLASSES[kind]}`}
      >
        {label}
      </span>
      <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-medium bg-default-50 p-2">
        {error ? (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        ) : !url ? (
          <Spinner size="sm" label="Loading preview" />
        ) : (
          <PreviewBody key={url} kind={kind} url={url} name={entry.name} />
        )}
      </div>
      <dl className="flex flex-col gap-2">
        <Detail label="Name" value={entry.name} />
        <Detail label="Path" value={`${bucket}/${path}`} />
        <Detail label="Type" value={entry.mimeType ?? "Unknown"} />
        <Detail label="Size" value={formatBytes(entry.size)} />
        <Detail
          label="Last updated"
          value={entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "Unknown"}
        />
      </dl>
      <ActionButton
        size="sm"
        tone="outline"
        className="shrink-0 self-start text-success"
        isDisabled={!url}
        onPress={() => void copy()}
      >
        <Icon name="ph:clipboard-text" width={14} height={14} />
        {copied ? "Copied" : "Copy URL"}
      </ActionButton>
      {!publicUrl && url ? (
        <p className="text-tiny text-default-500">This signed URL expires in 10 minutes.</p>
      ) : null}
    </aside>
  );
}
