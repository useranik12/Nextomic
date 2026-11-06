"use client";

import { layoutAnimations, timelineLength, type Animation, type Timeline } from "@nextomic/schema";
import { useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import { animationActions } from "./use-animations";

const LABEL_WIDTH = 224;
const ROW_HEIGHT = 32;
const RULER_HEIGHT = 28;
const MIN_LENGTH = 0.05;
const METHOD_COLOR: Record<Animation["method"], string> = {
  to: "bg-primary/70",
  from: "bg-success/70",
  fromTo: "bg-warning/70",
  set: "bg-default-500"
};

const snap = (seconds: number): number => Math.round(seconds * 20) / 20;
const clean = (seconds: number): string => String(Number(seconds.toFixed(2)));

type Drag = { id: string; mode: "move" | "resize"; startX: number; start: number; length: number };

/** Rows of animations on a time ruler. Drag a bar to move it, drag its right edge to resize it. */
export function TimelineTrack({
  timeline,
  selectedId,
  onSelect,
  time,
  onSeek
}: {
  timeline: Timeline;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  time: number;
  onSeek: (seconds: number) => void;
}) {
  const [pps, setPps] = useState(120);
  const drag = useRef<Drag | null>(null);
  const slots = useMemo(() => layoutAnimations(timeline.animations), [timeline.animations]);
  const total = Math.max(timelineLength(timeline.animations), 5);
  const width = Math.ceil((total + 2) * pps);
  const marks = Array.from({ length: Math.ceil(total + 2) + 1 }, (_, i) => i);

  function begin(event: React.PointerEvent, animation: Animation, mode: Drag["mode"]) {
    const slot = slots.find((s) => s.id === animation.id);
    if (!slot) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: animation.id,
      mode,
      startX: event.clientX,
      start: slot.start,
      length: slot.length
    };
    onSelect(animation.id);
  }

  function move(event: React.PointerEvent, animation: Animation) {
    const d = drag.current;
    if (!d || d.id !== animation.id) return;
    const delta = (event.clientX - d.startX) / pps;
    if (d.mode === "move") {
      animationActions.patchAnimation(timeline.id, animation.id, {
        position: { mode: "custom", value: clean(Math.max(0, snap(d.start + delta))) }
      });
    } else {
      const length = Math.max(MIN_LENGTH, snap(d.length + delta));
      const runs = animation.repeat >= 0 ? animation.repeat + 1 : 1;
      const duration = Math.max(MIN_LENGTH, (length - animation.delay) / runs);
      animationActions.patchAnimation(timeline.id, animation.id, {
        duration: Number(duration.toFixed(2))
      });
    }
  }

  function seekFromRuler(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, (event.clientX - rect.left) / pps));
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-divider bg-content1">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="flex items-center gap-1.5 text-small font-semibold">
          Animations
          <InfoTip
            text="Each row is one animation. The bar shows when it starts and how long it runs. Drag a bar to change its start, drag its right edge to change its length, and click the ruler to jump to a moment."
            label="Animations"
          />
        </span>
        <ActionButton
          size="sm"
          onPress={() => onSelect(animationActions.addAnimation(timeline.id)?.id ?? null)}
        >
          <Icon name="ph:plus" width={14} height={14} />
          Add animation
        </ActionButton>
        <label className="ml-auto flex items-center gap-2 text-tiny text-default-600">
          Zoom
          <input
            type="range"
            min={40}
            max={400}
            value={pps}
            aria-label="Timeline zoom"
            onChange={(e) => setPps(Number(e.target.value))}
            className="w-28"
          />
          <InfoTip
            text="Makes the time ruler wider or narrower. It does not change any animation."
            label="Timeline zoom"
          />
        </label>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="sticky left-0 z-10 shrink-0 bg-content1" style={{ width: LABEL_WIDTH }}>
          <div style={{ height: RULER_HEIGHT }} className="border-b border-divider" />
          {timeline.animations.map((animation, index) => (
            <div
              key={animation.id}
              style={{ height: ROW_HEIGHT }}
              className={
                "flex items-center gap-1 border-b border-divider px-2 " +
                (animation.id === selectedId ? "bg-default-200" : "")
              }
            >
              <button
                type="button"
                onClick={() => onSelect(animation.id)}
                className="min-w-0 flex-1 truncate text-left text-small outline-none focus-visible:ring-1 focus-visible:ring-default-800/40"
              >
                {animation.name || "Animation"}
              </button>
              <button
                type="button"
                aria-label={`Move ${animation.name} up`}
                disabled={index === 0}
                onClick={() => animationActions.moveAnimation(timeline.id, animation.id, -1)}
                className="rounded p-0.5 text-default-500 hover:text-foreground disabled:opacity-30"
              >
                <Icon name="ph:arrow-up" width={12} height={12} />
              </button>
              <button
                type="button"
                aria-label={`Move ${animation.name} down`}
                disabled={index === timeline.animations.length - 1}
                onClick={() => animationActions.moveAnimation(timeline.id, animation.id, 1)}
                className="rounded p-0.5 text-default-500 hover:text-foreground disabled:opacity-30"
              >
                <Icon name="ph:arrow-down" width={12} height={12} />
              </button>
              <button
                type="button"
                aria-label={`Duplicate ${animation.name}`}
                onClick={() =>
                  onSelect(
                    animationActions.duplicateAnimation(timeline.id, animation.id)?.id ?? null
                  )
                }
                className="rounded p-0.5 text-default-500 hover:text-foreground"
              >
                <Icon name="ph:copy" width={12} height={12} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${animation.name}`}
                onClick={() => {
                  animationActions.removeAnimation(timeline.id, animation.id);
                  if (animation.id === selectedId) onSelect(null);
                }}
                className="rounded p-0.5 text-default-500 hover:text-danger"
              >
                <Icon name="ph:trash" width={12} height={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="relative shrink-0" style={{ width }}>
          <div
            style={{ height: RULER_HEIGHT }}
            className="relative cursor-pointer border-b border-divider"
            onPointerDown={seekFromRuler}
            role="presentation"
          >
            {marks.map((second) => (
              <span
                key={second}
                style={{ left: second * pps }}
                className="absolute top-0 h-full border-l border-divider pl-1 text-tiny text-default-500"
              >
                {second}s
              </span>
            ))}
          </div>
          {timeline.animations.map((animation) => {
            const slot = slots.find((s) => s.id === animation.id);
            if (!slot) return null;
            return (
              <div
                key={animation.id}
                style={{ height: ROW_HEIGHT }}
                className="relative border-b border-divider"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${animation.name}, starts at ${clean(slot.start)} seconds, lasts ${clean(slot.length)} seconds`}
                  onPointerDown={(e) => begin(e, animation, "move")}
                  onPointerMove={(e) => move(e, animation)}
                  onPointerUp={() => (drag.current = null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(animation.id);
                  }}
                  style={{ left: slot.start * pps, width: Math.max(slot.length * pps, 8) }}
                  className={
                    "absolute top-1 flex h-6 cursor-grab items-center rounded px-2 text-tiny text-white outline-none focus-visible:ring-1 focus-visible:ring-default-800 " +
                    METHOD_COLOR[animation.method] +
                    (animation.id === selectedId ? " ring-1 ring-foreground" : "")
                  }
                >
                  <span className="truncate">{animation.name}</span>
                  <span
                    role="presentation"
                    onPointerDown={(e) => begin(e, animation, "resize")}
                    onPointerMove={(e) => move(e, animation)}
                    onPointerUp={() => (drag.current = null)}
                    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r bg-black/25"
                  />
                </div>
              </div>
            );
          })}
          <div
            aria-hidden
            style={{ left: time * pps }}
            className="pointer-events-none absolute top-0 h-full w-px bg-danger"
          />
        </div>
      </div>
      {timeline.animations.length === 0 ? (
        <p className="px-4 pb-3 text-small text-default-500">
          No animations in this timeline yet. Add one to start.
        </p>
      ) : null}
    </div>
  );
}
