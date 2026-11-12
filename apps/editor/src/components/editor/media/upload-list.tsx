"use client";

import { Icon } from "@/lib/icons/Icon";
import type { UploadItem } from "./use-media";

/** Progress of the files being uploaded; a failed file stays until dismissed, with its reason. */
export function UploadList({
  uploads,
  onDismiss
}: {
  uploads: UploadItem[];
  onDismiss: (key: string) => void;
}) {
  if (uploads.length === 0) return null;
  return (
    <ul aria-label="Uploads" className="flex flex-col gap-1.5 rounded-2xl border border-border p-3">
      {uploads.map((u) => (
        <li key={u.key} className="flex items-center gap-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-foreground">{u.name}</span>
          {u.error ? (
            <span role="alert" className="flex items-center gap-2 text-danger">
              {u.error}
              <button
                type="button"
                aria-label={`Dismiss ${u.name}`}
                onClick={() => onDismiss(u.key)}
              >
                <Icon name="ph:x" width={12} height={12} />
              </button>
            </span>
          ) : u.done ? (
            <span className="flex items-center gap-1 text-success">
              <Icon name="ph:check-circle" width={14} height={14} />
              Uploaded
            </span>
          ) : (
            <span className="flex w-40 items-center gap-2">
              <span
                role="progressbar"
                aria-label={`Uploading ${u.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(u.progress * 100)}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-default"
              >
                <span
                  className="block h-full bg-accent transition-[width]"
                  style={{ width: `${Math.round(u.progress * 100)}%` }}
                />
              </span>
              <span className="w-8 text-right text-muted">{Math.round(u.progress * 100)}%</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
