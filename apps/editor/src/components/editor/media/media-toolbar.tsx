"use client";

import { MEDIA_SORTS, MEDIA_TYPE_TABS, type MediaSort, type MediaTypeTab } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import type { MediaModel } from "./use-media";

export type MediaView = "grid" | "list";

const TAB_LABEL: Record<MediaTypeTab, string> = {
  all: "All",
  image: "Images",
  svg: "SVG",
  video: "Videos",
  other: "Other"
};
const SORT_LABEL: Record<MediaSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name",
  size: "Largest"
};

const FILE_ACCEPT = "image/*,video/*,audio/*,application/pdf,.svg";

export function MediaToolbar({
  model,
  view,
  onView
}: {
  model: MediaModel;
  view: MediaView;
  onView: (v: MediaView) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(model.query.search);
  const { patch } = model;

  useEffect(() => {
    const t = window.setTimeout(() => patch({ search: search.trim() }), 250);
    return () => window.clearTimeout(t);
  }, [search, patch]);

  const inTrash = model.query.filter === "trash";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {inTrash ? null : (
          <ActionButton
            tone="primary"
            size="sm"
            startContent={<Icon name="ph:upload-simple" width={14} height={14} />}
            onPress={() => input.current?.click()}
          >
            Upload
          </ActionButton>
        )}
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={FILE_ACCEPT}
          aria-label="Choose files to upload"
          data-testid="media-file-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length > 0) void model.upload(files);
          }}
        />
        <div className="min-w-48 max-w-sm flex-1">
          <FormInput
            aria-label="Search media"
            placeholder="Search media"
            value={search}
            onValueChange={setSearch}
            isClearable
            onClear={() => setSearch("")}
            maxLength={80}
            startContent={<Icon name="ph:magnifying-glass" width={14} height={14} />}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-32">
            <SelectField
              label="Sort"
              hideLabel
              value={model.query.sort}
              onValueChange={(v) => patch({ sort: v as MediaSort })}
              options={MEDIA_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))}
            />
          </div>
          <div role="group" aria-label="View" className="flex rounded-full bg-default/50 p-0.5">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === "grid" ? "Grid view" : "List view"}
                onClick={() => onView(v)}
                className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${view === v ? "bg-default text-foreground" : "text-muted hover:text-foreground"}`}
              >
                <Icon name={v === "grid" ? "ph:squares-four" : "ph:list"} width={16} height={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="File type" className="flex gap-1">
          {MEDIA_TYPE_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={model.query.type === t}
              onClick={() => patch({ type: t })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${model.query.type === t ? "bg-default text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {model.loading ? "Loading…" : `${model.total} ${model.total === 1 ? "item" : "items"}`}
        </p>
      </div>
    </div>
  );
}
