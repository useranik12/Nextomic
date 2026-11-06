"use client";

import { startTimelines } from "@nextomic/runtime";
import type { Timeline } from "@nextomic/schema";
import { useEffect } from "react";

/**
 * Starts the page's animation timelines in the browser (preview and published site). It renders
 * nothing. The timelines are cleaned up when the page unmounts.
 */
export function AnimationPlayer({ timelines }: { timelines: Timeline[] }) {
  useEffect(() => {
    if (timelines.length === 0) return;
    let destroyed = false;
    let stop: (() => void) | null = null;
    void startTimelines(timelines).then((handle) => {
      if (destroyed) handle.destroy();
      else stop = handle.destroy;
    });
    return () => {
      destroyed = true;
      stop?.();
    };
  }, [timelines]);
  return null;
}
