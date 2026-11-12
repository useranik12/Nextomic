"use client";

import { tagText } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";
import type { DynamicTag } from "./dynamic-sources";

/** A tag in the dynamic data modal: click inserts it; the wand opens it in the Transform view. */
export function TagCard({
  tag,
  onPick,
  onTransform
}: {
  tag: DynamicTag;
  onPick: () => void;
  onTransform: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onPick}
        title={tag.help}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-default py-2 pl-4 pr-11 text-left transition-colors duration-300 hover:bg-default-hover"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{tag.label}</span>
          <span className="block truncate font-mono text-xs text-muted">{tagText(tag.token)}</span>
        </span>
        <span className="shrink-0 text-xs text-muted">{tag.hint}</span>
      </button>
      <button
        type="button"
        aria-label={`Transform ${tag.label}`}
        title="Transform: format, convert or change the value before inserting"
        data-own-tip
        onClick={onTransform}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors duration-300 hover:bg-default-300 hover:text-foreground"
      >
        <Icon name="ph:magic-wand" width={14} height={14} />
      </button>
    </div>
  );
}
