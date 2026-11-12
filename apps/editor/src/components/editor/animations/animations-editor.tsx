"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { PageSummary } from "@/server/pages";
import {
  getAnimationState,
  getIdleAnimationState,
  sendAnimation,
  subscribeAnimationState
} from "../canvas/animation-bridge";
import { AnimationSettings } from "./animation-settings";
import { GsapCodeView } from "./gsap-code-view";
import { TimelineSettings } from "./timeline-settings";
import { TimelineTrack } from "./timeline-track";
import { TimelinesSidebar } from "./timelines-sidebar";
import { TransportBar } from "./transport-bar";
import { useAnimationSettings } from "./use-animations";

type PanelTab = "animation" | "timeline" | "code";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "animation", label: "Animation" },
  { id: "timeline", label: "Timeline" },
  { id: "code", label: "GSAP Code" }
];

/**
 * The full-screen Animations editor: timelines on the left, the page canvas with a transport bar
 * in the middle, the animation bars underneath and the settings on the right. The page itself is
 * the real canvas behind this layer, so a preview plays on the actual elements.
 */
export function AnimationsEditor({
  pages,
  onClose
}: {
  pages: readonly PageSummary[];
  onClose: () => void;
}) {
  const settings = useAnimationSettings();
  const [timelineId, setTimelineId] = useState<string | null>(settings.timelines[0]?.id ?? null);
  const [animationId, setAnimationId] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("timeline");
  const state = useSyncExternalStore(
    subscribeAnimationState,
    getAnimationState,
    getIdleAnimationState
  );

  const timeline = settings.timelines.find((t) => t.id === timelineId) ?? null;
  const animation = timeline?.animations.find((a) => a.id === animationId) ?? null;

  // Keep the preview on the canvas in step with the timeline being edited.
  const signature = useMemo(() => (timeline ? JSON.stringify(timeline) : ""), [timeline]);
  useEffect(() => {
    if (!timeline || timeline.animations.length === 0) {
      sendAnimation({ type: "anim-control", command: "clear" });
      return;
    }
    const handle = window.setTimeout(() => sendAnimation({ type: "anim-load", timeline }), 250);
    return () => window.clearTimeout(handle);
    // `signature` stands for the whole timeline value.
  }, [signature]);

  useEffect(() => () => sendAnimation({ type: "anim-control", command: "clear" }), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "Escape" && !typing) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function selectTimeline(id: string | null) {
    setTimelineId(id);
    setAnimationId(null);
    setTab("timeline");
  }

  function selectAnimation(id: string | null) {
    setAnimationId(id);
    if (id) setTab("animation");
  }

  const activeTab: PanelTab = tab === "animation" && !animation ? "timeline" : tab;

  return (
    <div
      role="dialog"
      aria-label="Animations"
      className="pointer-events-none absolute inset-0 z-30 flex bg-transparent"
    >
      <div className="pointer-events-auto">
        <TimelinesSidebar selectedId={timelineId} onSelect={selectTimeline} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TransportBar
          timelineName={timeline?.name ?? null}
          state={state}
          onPlay={() => sendAnimation({ type: "anim-control", command: "play" })}
          onPause={() => sendAnimation({ type: "anim-control", command: "pause" })}
          onStop={() => sendAnimation({ type: "anim-control", command: "stop" })}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1" />
        {timeline ? (
          <div className="pointer-events-auto h-72 shrink-0">
            <TimelineTrack
              timeline={timeline}
              selectedId={animationId}
              onSelect={selectAnimation}
              time={state.time}
              onSeek={(time) => sendAnimation({ type: "anim-seek", time })}
            />
          </div>
        ) : (
          <div className="pointer-events-auto border-t border-border bg-surface p-6 text-sm text-muted">
            Create or pick a timeline on the left to start.
          </div>
        )}
      </div>
      <aside
        aria-label="Animation settings"
        className="pointer-events-auto flex h-full w-96 shrink-0 flex-col border-l border-border bg-surface"
      >
        {timeline ? (
          <>
            <div role="tablist" className="flex shrink-0 gap-1 border-b border-border px-3 py-2">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  disabled={item.id === "animation" && !animation}
                  onClick={() => setTab(item.id)}
                  className={
                    "rounded-full px-3 py-1.5 text-sm transition-colors duration-300 disabled:opacity-40 " +
                    (activeTab === item.id
                      ? "bg-default-hover text-foreground"
                      : "text-body hover:bg-default")
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeTab === "animation" && animation ? (
                <AnimationSettings timelineId={timeline.id} animation={animation} />
              ) : activeTab === "code" ? (
                <GsapCodeView timeline={timeline} />
              ) : (
                <TimelineSettings timeline={timeline} pages={pages} />
              )}
            </div>
          </>
        ) : (
          <p className="p-4 text-sm text-muted">
            Settings appear here when a timeline is selected.
          </p>
        )}
      </aside>
    </div>
  );
}
