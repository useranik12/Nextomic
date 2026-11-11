"use client";

import { Chip, Spinner } from "@heroui-v2/react";
import type { StorageEntry } from "@nextomic/integrations";
import type { SupabaseBucket } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { browseSupabaseBucketAction } from "@/app/(builder)/editor/[id]/connector-actions";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { ObjectPreview } from "./object-preview";
import { SupabaseCard } from "./supabase-page";
import type { SupabasePageModel } from "./use-supabase-page";

const BUCKET_POLICY_SQL = `create policy "Anon can list buckets" on storage.buckets
  for select to anon using (true);`;

/** Public object URL of a file in a public bucket. */
const publicUrl = (base: string, bucket: string, path: string) =>
  `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;

/** Live listing of one folder; nothing here is saved. */
function useFolder(
  projectId: string,
  connectorId: string,
  bucket: string,
  prefix: string,
  active: boolean
) {
  const [entries, setEntries] = useState<StorageEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let stale = false;
    setEntries(null);
    setError(null);
    void browseSupabaseBucketAction(projectId, connectorId, bucket, prefix).then((result) => {
      if (stale) return;
      if (result.data === null) setError(result.error);
      else setEntries(result.data);
    });
    return () => {
      stale = true;
    };
  }, [projectId, connectorId, bucket, prefix, active]);
  return { entries, error };
}

function BucketBrowser({
  projectId,
  connectorId,
  baseUrl,
  bucket,
  active
}: {
  projectId: string;
  connectorId: string;
  baseUrl: string;
  bucket: SupabaseBucket;
  active: boolean;
}) {
  const [path, setPath] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<StorageEntry | null>(null);
  const prefix = path.join("/");
  const fullPath = (name: string) => (prefix ? `${prefix}/${name}` : name);
  const { entries, error } = useFolder(projectId, connectorId, bucket.name, prefix, active);

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
  }

  const openFolder = (next: string[]) => {
    setPath(next);
    setPreview(null);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-mono text-medium font-semibold text-foreground">{bucket.name}</h3>
          <Chip size="sm" variant="flat" color={bucket.public ? "success" : "default"}>
            {bucket.public ? "Public" : "Private"}
          </Chip>
        </div>
        <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => openFolder([])}
            className="rounded-small bg-default-100 px-3 py-1 text-tiny text-default-600 hover:bg-default-200"
          >
            objects
          </button>
          {path.map((part, i) => (
            <button
              key={`${i}-${part}`}
              type="button"
              onClick={() => openFolder(path.slice(0, i + 1))}
              className="rounded-small bg-default-100 px-3 py-1 text-tiny text-default-600 hover:bg-default-200"
            >
              {part}
            </button>
          ))}
        </nav>
        {!active ? (
          <p className="text-small text-default-500">Turn the connection on to browse files.</p>
        ) : error ? (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        ) : !entries ? (
          <Spinner size="sm" label="Loading files" className="self-start" />
        ) : entries.length === 0 ? (
          <p className="text-small text-default-500">
            This folder is empty, or the anon key may not list it.
          </p>
        ) : (
          <ul className="flex min-h-0 flex-col overflow-y-auto">
            {entries.map((entry) => {
              const full = fullPath(entry.name);
              const url = publicUrl(baseUrl, bucket.name, full);
              return (
                <li
                  key={entry.name}
                  className="flex items-center justify-between gap-3 border-b border-divider py-1.5 last:border-b-0"
                >
                  {entry.folder ? (
                    <button
                      type="button"
                      onClick={() => openFolder([...path, entry.name])}
                      className="flex items-center gap-2 text-small text-foreground hover:underline"
                    >
                      <Icon name="ph:folder" width={16} height={16} className="text-default-500" />
                      {entry.name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-tip="Double-click to preview"
                      aria-label={`${entry.name}: press Enter to preview`}
                      aria-pressed={preview?.name === entry.name}
                      onDoubleClick={() => setPreview(entry)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setPreview(entry);
                        }
                      }}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-small px-1 text-left text-small ${preview?.name === entry.name ? "bg-default-100 text-foreground" : "text-default-600 hover:text-foreground"}`}
                    >
                      <Icon
                        name="ph:file"
                        width={16}
                        height={16}
                        className="shrink-0 text-default-500"
                      />
                      <span className="truncate">{bucket.public ? url : entry.name}</span>
                    </button>
                  )}
                  {!entry.folder && bucket.public ? (
                    <ActionButton
                      size="sm"
                      tone="ghost"
                      className="shrink-0 text-success"
                      onPress={() => void copy(url)}
                    >
                      <Icon name="ph:clipboard-text" width={14} height={14} />
                      {copied === url ? "Copied" : "Copy URL"}
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {!bucket.public ? (
          <p className="text-tiny text-default-500">
            Files of a private bucket are reached with signed URLs at run time.
          </p>
        ) : null}
      </div>
      {preview ? (
        <ObjectPreview
          key={fullPath(preview.name)}
          projectId={projectId}
          connectorId={connectorId}
          bucket={bucket.name}
          path={fullPath(preview.name)}
          entry={preview}
          publicUrl={bucket.public ? publicUrl(baseUrl, bucket.name, fullPath(preview.name)) : null}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

/** Buckets the anon key can see, with live folder browsing. */
export function StorageCard({ projectId, model }: { projectId: string; model: SupabasePageModel }) {
  const structure = model.data?.schema?.structure ?? null;
  const connector = model.connector;
  const [chosen, setChosen] = useState<string | null>(null);
  const buckets = structure?.buckets ?? [];
  const bucket = buckets.find((b) => b.name === chosen) ?? buckets[0] ?? null;
  const baseUrl =
    typeof connector?.config.projectUrl === "string" ? connector.config.projectUrl : "";

  return (
    <SupabaseCard
      title="Storage"
      description="Fetched storage buckets."
      className={buckets.length > 0 ? "h-[700px]" : undefined}
    >
      {!structure || !connector ? (
        <p className="text-small text-default-500">Fetch the schema to see the buckets.</p>
      ) : buckets.length === 0 ? (
        <div className="flex flex-col gap-2 text-small text-default-500">
          <p>
            The anon key sees no buckets. Supabase lists only the buckets the anon role may read
            (row level security on storage.buckets). To show them, run this in the Supabase SQL
            editor, then fetch again:
          </p>
          <pre className="overflow-x-auto rounded-medium bg-default-100 p-3 font-mono text-tiny text-foreground">
            {BUCKET_POLICY_SQL}
          </pre>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <ul
            className="flex min-h-0 w-full shrink-0 flex-col gap-0.5 overflow-y-auto md:w-64"
            aria-label="Buckets"
          >
            {buckets.map((b) => (
              <li key={b.name}>
                <button
                  type="button"
                  aria-current={b.name === bucket?.name}
                  onClick={() => setChosen(b.name)}
                  className={`flex w-full items-center gap-2 rounded-full px-4 py-2 text-left text-small transition-colors duration-300 ${b.name === bucket?.name ? "bg-default-100 text-foreground" : "text-default-600 hover:bg-default-50"}`}
                >
                  <span className="truncate font-mono">{b.name}</span>
                  <span className="rounded-full border border-default-300 px-1.5 text-tiny">
                    {b.objectCount}
                    {b.countCapped ? "+" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {bucket ? (
            <BucketBrowser
              key={bucket.name}
              projectId={projectId}
              connectorId={connector.id}
              baseUrl={baseUrl}
              bucket={bucket}
              active={connector.active}
            />
          ) : null}
        </div>
      )}
    </SupabaseCard>
  );
}
