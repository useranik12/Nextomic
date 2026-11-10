"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

// Pan and zoom of the flow canvas: hold the right mouse button on a free area and drag to move,
// turn the wheel to zoom around the pointer. Nodes keep their own right-click menu.

export interface CanvasView {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const HOME: CanvasView = { x: 0, y: 0, scale: 1 };

/** True when the pointer is on a node, a control or a menu, not on the free canvas. */
const onControl = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest("[data-flow-node], button, a, input, textarea, select, [role=menu]"));

export function useCanvasView(resetKey: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<CanvasView>(HOME);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const reset = useCallback(() => setView(HOME), []);

  useEffect(reset, [resetKey, reset]);

  // A wheel listener must be non-passive to stop the page from scrolling, so it is added by hand.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      setView((v) => {
        const scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, v.scale * Math.exp(-e.deltaY * 0.0015))
        );
        const k = scale / v.scale;
        return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 2 || onControl(e.target)) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx === 0 && dy === 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: true };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setPanning(false);
  };
  // The browser menu never opens on the free canvas; nodes open their own.
  const onContextMenu = (e: React.MouseEvent) => {
    if (!onControl(e.target)) e.preventDefault();
  };

  return {
    ref,
    view,
    panning,
    reset,
    zoomBy: (factor: number) =>
      setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor)) })),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onContextMenu
    }
  };
}
