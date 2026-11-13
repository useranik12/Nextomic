"use client";

import { formatBytes, type MediaAsset } from "@nextomic/schema";
import { useRef } from "react";
import { CheckField } from "@/components/ui/toggles";
import { Icon } from "@/lib/icons/Icon";
import { MediaThumb, mediaLabel } from "./media-thumb";
import type { MediaView } from "./media-toolbar";

interface Props {
  assets: MediaAsset[];
  view: MediaView;
  selected: ReadonlySet<string>;
  openId: string | null;
  onOpen: (id: string) => void;
  onSelect: (ids: ReadonlySet<string>) => void;
}

/** Grid or list of files. Selecting a row's box adds it to the selection; shift extends a range. */
export function MediaGrid({ assets, view, selected, openId, onOpen, onSelect }: Props) {
  const anchor = useRef<string | null>(null);
  const shift = useRef(false);

  function toggle(id: string, shift: boolean) {
    const next = new Set(selected);
    if (shift && anchor.current) {
      const a = assets.findIndex((x) => x.id === anchor.current);
      const b = assets.findIndex((x) => x.id === id);
      if (a >= 0 && b >= 0)
        for (const x of assets.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x.id);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = id;
    onSelect(next);
  }

  const check = (a: MediaAsset) => (
    <span
      onClickCapture={(e) => {
        shift.current = e.shiftKey;
      }}
      className="inline-flex"
    >
      <CheckField
        aria-label={`Select ${mediaLabel(a)}`}
        isSelected={selected.has(a.id)}
        onChange={() => toggle(a.id, shift.current)}
      />
    </span>
  );

  const badge = (a: MediaAsset) =>
    (a.kind === "image" || a.kind === "svg") && a.alt === "" ? (
      <span title="Missing alt text" className="text-warning">
        <Icon name="ph:warning" width={14} height={14} label="Missing alt text" />
      </span>
    ) : null;

  if (view === "list")
    return (
      <ul aria-label="Media files" className="flex flex-col gap-1">
        {assets.map((a) => (
          <li key={a.id}>
            <div
              className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors ${openId === a.id ? "bg-default" : "hover:bg-default/40"}`}
            >
              {check(a)}
              <button
                type="button"
                onClick={() => onOpen(a.id)}
                aria-label={`Open ${mediaLabel(a)}`}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <MediaThumb asset={a} className="h-10 w-10 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {mediaLabel(a)}
                </span>
                <span className="hidden w-16 text-xs uppercase text-muted sm:block">
                  {a.fileName.split(".").pop()}
                </span>
                <span className="w-20 text-right text-xs text-muted">{formatBytes(a.size)}</span>
                {badge(a)}
              </button>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <ul
      aria-label="Media files"
      className="grid grid-cols-[repeat(auto-fill,10rem)] justify-start gap-3"
    >
      {assets.map((a) => (
        <li key={a.id}>
          <div
            className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-colors ${openId === a.id ? "border-accent" : "border-border hover:border-muted"}`}
          >
            <button
              type="button"
              onClick={() => onOpen(a.id)}
              aria-label={`Open ${mediaLabel(a)}`}
              className="flex flex-col text-left"
            >
              <MediaThumb asset={a} className="aspect-square w-full" />
              <span className="flex flex-col gap-0.5 px-3 py-2">
                <span className="truncate text-sm text-foreground">{mediaLabel(a)}</span>
                <span className="flex items-center justify-between text-xs text-muted">
                  {formatBytes(a.size)}
                  {badge(a)}
                </span>
              </span>
            </button>
            <span
              className={`absolute left-2 top-2 drop-shadow ${selected.has(a.id) ? "" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"}`}
            >
              {check(a)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
