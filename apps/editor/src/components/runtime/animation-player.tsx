"use client";

import { startCssAnimations, startTimelines } from "@nextomic/runtime";
import type { ElementAnimationSpec, Timeline } from "@nextomic/schema";
import { useEffect } from "react";

/**
 * Starts the page's animations in the browser (preview and published site): the GSAP timelines and
 * the ready-made CSS animations of elements. It renders nothing and cleans up on unmount.
 */
export function AnimationPlayer({
  timelines,
  elementAnimations
}: {
  timelines: Timeline[];
  elementAnimations: ElementAnimationSpec[];
}) {
  useEffect(() => {
    if (elementAnimations.length === 0) return;
    const handle = startCssAnimations(elementAnimations);
    return () => handle.destroy();
  }, [elementAnimations]);

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
