"use client";

import { ActionButton } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import type { AnimationPreviewState } from "../canvas/animation-bridge";

const format = (seconds: number): string => seconds.toFixed(2).padStart(5, "0");

function Transport({
  label,
  icon,
  onClick,
  disabled
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-default text-foreground transition-colors duration-300 hover:bg-default-hover disabled:opacity-40"
    >
      <Icon name={icon} width={16} height={16} />
    </button>
  );
}

/** Play, pause and stop for the preview on the canvas, with the current time. */
export function TransportBar({
  timelineName,
  state,
  onPlay,
  onPause,
  onStop,
  onClose
}: {
  timelineName: string | null;
  state: AnimationPreviewState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const ready = state.duration > 0;
  return (
    <div className="pointer-events-auto flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <ActionButton size="sm" tone="ghost" onPress={onClose}>
        <Icon name="ph:arrow-left" width={14} height={14} />
        Back to editor
      </ActionButton>
      <span className="truncate text-sm font-semibold">{timelineName ?? "Animations"}</span>
      <div className="ml-4 flex items-center gap-2">
        {state.playing ? (
          <Transport label="Pause preview" icon="ph:pause" onClick={onPause} />
        ) : (
          <Transport label="Play preview" icon="ph:play" onClick={onPlay} disabled={!ready} />
        )}
        <Transport
          label="Stop preview and go to the start"
          icon="ph:stop"
          onClick={onStop}
          disabled={!ready}
        />
        <span className="font-mono text-sm tabular-nums text-body" aria-live="off">
          {format(state.time)} / {format(state.duration)}s
        </span>
        <InfoTip
          text="Plays the selected timeline here on the canvas so you can see it. Scroll, click and hover triggers are not needed for the preview. Stop puts the page back as it was."
          label="Preview controls"
          placement="bottom"
        />
      </div>
    </div>
  );
}
