"use client";

import type { ElementQuery } from "@nextomic/schema";
import { ActionButton } from "@/components/ui/controls";
import { previewAllowed, useLoopPreview } from "../canvas/use-canvas-loop-rows";

// The end of a REST loop's Query Loop group: the canvas fetches a REST loop only when asked here,
// because API requests can cost money. A changed query waits for the next press.

export function RestPreview({
  id,
  query,
  disabled
}: {
  id: string;
  query: ElementQuery;
  disabled: boolean;
}) {
  const approved = useLoopPreview((s) => s.approved);
  const approve = useLoopPreview((s) => s.approve);
  const fetched = previewAllowed(id, query, approved);
  return (
    <div className="flex flex-col gap-2">
      <ActionButton
        size="sm"
        tone="ghost"
        className="self-start"
        isDisabled={disabled}
        onPress={() => approve(id, query)}
      >
        {fetched ? "Fetch preview again" : "Fetch preview"}
      </ActionButton>
      <p className="text-xs text-muted">
        {fetched
          ? "The canvas shows the fetched rows. Changing the query waits for another fetch."
          : "The canvas shows a placeholder until you fetch a preview. Each fetch sends a real request to the API."}
      </p>
    </div>
  );
}
