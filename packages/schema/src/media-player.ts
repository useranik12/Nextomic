import { walkElements, type ElementNode } from "./element";

// Shared facts of the Video and Audio players (docs/elements.md "Video and Audio"): the renderer
// draws from them, the runtime reads the same numbers back, and the editor builds its switches
// from the same list, so the three never drift apart.

export const PLAYER_CONTROL_MODES = ["custom", "native", "none"] as const;
export const PLAYER_PRELOADS = ["metadata", "none", "auto"] as const;
export const PLAYER_BAR_POSITIONS = ["overlay", "below", "above"] as const;

export type PlayerControlMode = (typeof PLAYER_CONTROL_MODES)[number];

/** A control of the bar that the Element tab can show or hide. */
export interface PlayerSwitch {
  /** The prop that holds the On / Off switch. */
  prop: string;
  label: string;
  /** Only the video has it. */
  videoOnly?: boolean;
  /** Starts On in a new element. */
  on: boolean;
}

/** Every show/hide switch, in the order of the default bar. */
export const PLAYER_SWITCHES: readonly PlayerSwitch[] = [
  { prop: "showBig", label: "Big play button", videoOnly: true, on: true },
  { prop: "showTitle", label: "Title", on: false },
  { prop: "showBack", label: "Skip back button", on: false },
  { prop: "showPlay", label: "Play button", on: true },
  { prop: "showForward", label: "Skip forward button", on: false },
  { prop: "showSeek", label: "Seek bar", on: true },
  { prop: "showTime", label: "Time", on: true },
  { prop: "showMute", label: "Mute button", on: true },
  { prop: "showVolume", label: "Volume slider", on: true },
  { prop: "showSpeed", label: "Speed button", on: false },
  { prop: "showLoop", label: "Loop button", on: false },
  { prop: "showCaptions", label: "Captions button", videoOnly: true, on: true },
  { prop: "showPip", label: "Picture in Picture button", videoOnly: true, on: false },
  { prop: "showFull", label: "Full screen button", videoOnly: true, on: true },
  { prop: "showDownload", label: "Download button", on: false }
];

export const DEFAULT_SPEEDS = "0.5, 0.75, 1, 1.25, 1.5, 2";
export const DEFAULT_SKIP_SECONDS = 10;
/** The most the runtime accepts for one skip, in seconds. */
export const MAX_SKIP_SECONDS = 3600;

/** A list of speeds written as text ("0.5, 1, 2"); unusable entries are dropped. Never empty. */
export function parseSpeeds(text: string): number[] {
  const speeds = text
    .split(/[\s,;]+/)
    .map((part) => Number(part.replace(/x$/i, "")))
    .filter((n) => Number.isFinite(n) && n >= 0.0625 && n <= 16);
  return speeds.length > 0 ? [...new Set(speeds)].sort((a, b) => a - b).slice(0, 20) : [1];
}

/** Seconds from text; `fallback` when it is empty, not a number or negative. */
export function parseSeconds(text: string, fallback: number): number {
  if (text.trim() === "") return fallback;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 86_400 * 7) : fallback;
}

/** "0:07", "12:03" or "1:02:03" for a number of seconds; "0:00" when it is not known yet. */
export function clockText(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The label of a speed on its button: 1 -> "1x", 0.75 -> "0.75x". */
export const speedText = (speed: number): string => `${Number(speed.toFixed(3))}x`;

/** Whether any tree holds a Video or Audio element (its bar needs the page runtime). */
export const hasPlayer = (...roots: ElementNode[]): boolean => {
  let found = false;
  for (const root of roots)
    walkElements(root, (node) => {
      if (node.type === "video" || node.type === "audio") found = true;
    });
  return found;
};
