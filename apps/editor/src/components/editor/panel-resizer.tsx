"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from "react";

const MAX_FRACTION = 0.25;
const KEY_STEP = 16;

/** The widest a side panel may be: 25% of the window, never narrower than its minimum. */
export const maxPanelWidth = (min: number): number =>
  Math.max(min, Math.floor(window.innerWidth * MAX_FRACTION));

function readStored(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * A side panel width the user can drag, remembered in this browser. The width always stays between
 * `min` and 25% of the window, also when the window is made smaller.
 */
export function usePanelWidth(
  storageKey: string,
  initial: number,
  min: number
): { width: number; setWidth: (next: number) => void; reset: () => void } {
  const [width, setRaw] = useState(initial);

  const clamp = useCallback(
    (value: number) => Math.min(maxPanelWidth(min), Math.max(min, Math.round(value))),
    [min]
  );

  useEffect(() => {
    setRaw(clamp(readStored(storageKey) ?? initial));
    const onResize = () => setRaw((current) => clamp(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [storageKey, initial, clamp]);

  const setWidth = useCallback(
    (next: number) => {
      const value = clamp(next);
      setRaw(value);
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // Storage can be blocked; the width then lasts for this visit only.
      }
    },
    [clamp, storageKey]
  );

  const reset = useCallback(() => {
    setRaw(clamp(initial));
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing stored to clear.
    }
  }, [clamp, initial, storageKey]);

  return { width, setWidth, reset };
}

/**
 * The drag handle on the inner edge of a side panel: a thin line with a grip centred on it, so it is
 * clear the panel can be resized. Works with a pointer and with the arrow keys. `side` is the side of
 * the screen the panel is on.
 */
export function PanelResizer({
  side,
  width,
  min,
  label,
  onResize
}: {
  side: "left" | "right";
  width: number;
  min: number;
  label: string;
  onResize: (next: number) => void;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [active, setActive] = useState(false);
  const direction = side === "left" ? 1 : -1;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width };
    setActive(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    onResize(start.current.width + (event.clientX - start.current.x) * direction);
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    start.current = null;
    setActive(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === grow) onResize(width + KEY_STEP);
    else if (event.key === shrink) onResize(width - KEY_STEP);
    else return;
    event.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      className={
        "group absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none " +
        (side === "left" ? "-right-1" : "-left-1")
      }
    >
      <span
        aria-hidden
        className={
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-300 group-hover:w-0.5 group-focus-visible:w-0.5 " +
          (active
            ? "w-0.5 bg-accent"
            : "bg-transparent group-hover:bg-accent group-focus-visible:bg-accent")
        }
      />
      <span
        aria-hidden
        className={
          "absolute left-1/2 top-1/2 flex h-10 w-3 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[3px] rounded-full border border-border bg-surface shadow-sm transition-colors duration-300 group-hover:border-accent group-focus-visible:border-accent " +
          (active ? "border-accent" : "")
        }
      >
        <span className="h-[3px] w-[3px] rounded-full bg-default-500" />
        <span className="h-[3px] w-[3px] rounded-full bg-default-500" />
        <span className="h-[3px] w-[3px] rounded-full bg-default-500" />
      </span>
    </div>
  );
}
