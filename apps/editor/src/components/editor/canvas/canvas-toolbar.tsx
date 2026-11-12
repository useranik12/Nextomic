"use client";

import { Icon } from "@/lib/icons/Icon";

interface ToolbarProps {
  zoom: number;
  canRotate: boolean;
  rotated: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onActualSize: () => void;
  onFit: () => void;
  onRotate: () => void;
}

const BUTTON =
  "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm text-body transition-colors duration-300 hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40";

export function CanvasToolbar({
  zoom,
  canRotate,
  rotated,
  onZoomOut,
  onZoomIn,
  onActualSize,
  onFit,
  onRotate
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas view"
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 shadow-lg"
    >
      <button type="button" aria-label="Zoom out" className={BUTTON} onClick={onZoomOut}>
        <Icon name="ph:minus" width={16} height={16} />
      </button>
      <button
        type="button"
        aria-label="Actual size (100%)"
        className={`${BUTTON} w-14 font-medium`}
        onClick={onActualSize}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="Zoom in" className={BUTTON} onClick={onZoomIn}>
        <Icon name="ph:plus" width={16} height={16} />
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-default-hover" />
      <button type="button" aria-label="Fit to screen" className={BUTTON} onClick={onFit}>
        <Icon name="ph:corners-out" width={16} height={16} />
      </button>
      <button
        type="button"
        aria-label="Rotate device"
        aria-pressed={rotated}
        disabled={!canRotate}
        className={`${BUTTON} ${rotated ? "bg-default text-foreground" : ""}`}
        onClick={onRotate}
      >
        <Icon name="ph:device-rotate" width={16} height={16} />
      </button>
    </div>
  );
}
