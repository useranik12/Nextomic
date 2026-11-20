import { clockText, safeUrl, speedText } from "@nextomic/schema";

// One Video or Audio player (docs/elements.md "Video and Audio"): reads the real media element and
// writes what it says into the bar (time, buffered part, volume, pressed buttons, state), and
// carries out the commands of the buttons, the keyboard and the actions.

export const PLAYER = "[data-nxt-media]";

export const mediaOf = (player: Element): HTMLMediaElement | null =>
  player.querySelector<HTMLMediaElement>("[data-nxt-el]");

/** The player that holds an element (or is it). */
export const playerOf = (el: EventTarget | null): HTMLElement | null =>
  el instanceof Element ? el.closest<HTMLElement>(PLAYER) : null;

const num = (value: string | null, fallback: number): number => {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) ? n : fallback;
};

const setFraction = (el: Element | null, name: string, value: number) =>
  (el as HTMLElement | null)?.style.setProperty(name, String(Math.min(1, Math.max(0, value))));

const press = (player: Element, kind: string, pressed: boolean) =>
  player
    .querySelectorAll(`[data-nxt-btn="${kind}"]`)
    .forEach((b) => b.setAttribute("aria-pressed", pressed ? "true" : "false"));

/** The seconds a Stop goes back to. */
const startOf = (player: Element) => num(player.getAttribute("data-start"), 0);

const captionTrack = (media: HTMLMediaElement): TextTrack | null => {
  for (const track of Array.from(media.textTracks))
    if (track.kind === "captions" || track.kind === "subtitles") return track;
  return null;
};

/** Writes the media element's state into the player's bar and state attributes. */
export function syncPlayer(player: HTMLElement): void {
  const media = mediaOf(player);
  if (!media) return;
  const duration = Number.isFinite(media.duration) ? media.duration : 0;
  const state = media.ended ? "ended" : media.paused ? "paused" : "playing";
  player.setAttribute("data-state", state);
  player.toggleAttribute("data-muted", media.muted || media.volume === 0);
  player.toggleAttribute("data-loop", media.loop);
  player.toggleAttribute("data-fullscreen", document.fullscreenElement === player);
  player.toggleAttribute("data-buffering", !media.paused && media.readyState < 3);
  const seek = player.querySelector<HTMLElement>("[data-nxt-seek]");
  setFraction(seek, "--nxt-p", duration > 0 ? media.currentTime / duration : 0);
  if (seek && media.buffered.length > 0 && duration > 0)
    setFraction(seek, "--nxt-b", media.buffered.end(media.buffered.length - 1) / duration);
  const seekInput = seek?.querySelector<HTMLInputElement>("input");
  // While the visitor drags the thumb, the input keeps what the hand says.
  if (seekInput && !seekInput.hasAttribute("data-dragging")) {
    seekInput.value = String(duration > 0 ? Math.round((media.currentTime / duration) * 1000) : 0);
    seekInput.setAttribute(
      "aria-valuetext",
      `${clockText(media.currentTime)} of ${clockText(duration)}`
    );
  }
  const current = player.querySelector("[data-nxt-current]");
  if (current) current.textContent = clockText(media.currentTime);
  const length = player.querySelector("[data-nxt-duration]");
  if (length) length.textContent = clockText(duration);
  const level = media.muted ? 0 : media.volume;
  const vol = player.querySelector<HTMLElement>("[data-nxt-vol]");
  setFraction(vol, "--nxt-p", level);
  const volInput = vol?.querySelector<HTMLInputElement>("input");
  if (volInput) volInput.value = String(Math.round(level * 100));
  press(player, "play", state === "playing");
  press(player, "mute", media.muted || media.volume === 0);
  press(player, "loop", media.loop);
  press(player, "fullscreen", document.fullscreenElement === player);
  const track = captionTrack(media);
  press(player, "captions", track?.mode === "showing");
  const speed = player.querySelector("[data-nxt-btn='speed']");
  if (speed) speed.textContent = speedText(media.playbackRate);
}

const mounted = new WeakSet<Element>();

/** Takes a player over: the native bar goes, the speed and start time are set, the bar is drawn. */
export function mountPlayer(player: HTMLElement): void {
  if (mounted.has(player)) return;
  const media = mediaOf(player);
  if (!media) return;
  mounted.add(player);
  if (player.getAttribute("data-controls") === "custom") media.removeAttribute("controls");
  media.playbackRate = num(player.getAttribute("data-speed"), 1);
  const track = captionTrack(media);
  if (track) track.mode = "hidden";
  const start = startOf(player);
  if (start > 0) {
    const seekToStart = () => {
      if (media.currentTime < start) media.currentTime = start;
    };
    if (media.readyState >= 1) seekToStart();
    else media.addEventListener("loadedmetadata", seekToStart, { once: true });
  }
  player.setAttribute("data-nxt-ready", "");
  syncPlayer(player);
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export class PlayerError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

/** The next speed in the player's list after the current one (the first when it is the last). */
function nextSpeed(player: Element, current: number): number {
  const speeds = (player.getAttribute("data-speeds") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (speeds.length === 0) return 1;
  return speeds.find((s) => s > current + 0.001) ?? speeds[0]!;
}

/** Plays; a browser that wants a click first refuses, and the action says so. */
async function play(media: HTMLMediaElement): Promise<void> {
  try {
    await media.play();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof DOMException && e.name === "NotAllowedError")
      throw new PlayerError(
        "blocked",
        "The browser blocked playing until the visitor clicks the page."
      );
    throw new PlayerError("play-failed", "The file could not be played.");
  }
}

/** The on/off/toggle choice of a command, against the current state. */
export function wanted(mode: string, now: boolean, yes: string[], no: string[]): boolean {
  if (yes.includes(mode)) return true;
  if (no.includes(mode)) return false;
  return !now;
}

/** Carries out one command on a player. The same code serves buttons, keys and actions. */
export async function runCommand(
  player: HTMLElement,
  command: string,
  params: Record<string, string> = {}
): Promise<void> {
  mountPlayer(player);
  const media = mediaOf(player);
  if (!media) throw new PlayerError("no-media", "This player has no media element.");
  const duration = Number.isFinite(media.duration) ? media.duration : 0;
  const seekTo = (seconds: number) => {
    media.currentTime = clamp(seconds, 0, duration > 0 ? duration : Math.max(seconds, 0));
  };
  switch (command) {
    case "play":
      return play(media);
    case "pause":
      return media.pause();
    case "toggle":
      return media.paused || media.ended ? play(media) : media.pause();
    case "stop":
      media.pause();
      media.currentTime = startOf(player);
      player.dispatchEvent(new CustomEvent("nxt-stopped", { bubbles: true }));
      return;
    case "seek": {
      const value = Number(params.value);
      if (!Number.isFinite(value) || value < 0)
        throw new PlayerError("bad-time", "Seek needs a number of zero or more.");
      if (params.mode === "percent") {
        if (duration <= 0) throw new PlayerError("not-ready", "The length is not known yet.");
        return seekTo((clamp(value, 0, 100) / 100) * duration);
      }
      return seekTo(value);
    }
    case "skip": {
      const seconds = Number(params.seconds);
      if (!Number.isFinite(seconds)) throw new PlayerError("bad-time", "Skip needs a number.");
      return seekTo(media.currentTime + seconds);
    }
    case "volume": {
      const level = Number(params.level);
      if (!Number.isFinite(level)) throw new PlayerError("bad-volume", "Volume needs a number.");
      media.volume = clamp(level, 0, 100) / 100;
      media.muted = level <= 0;
      return;
    }
    case "mute":
      media.muted = wanted(params.mode ?? "toggle", media.muted, ["mute"], ["unmute"]);
      return;
    case "speed": {
      const speed = Number(params.speed);
      if (!Number.isFinite(speed) || speed <= 0)
        throw new PlayerError("bad-speed", "Speed needs a number above zero.");
      media.playbackRate = clamp(speed, 0.0625, 16);
      return;
    }
    case "nextSpeed":
      media.playbackRate = nextSpeed(player, media.playbackRate);
      return;
    case "loop":
      media.loop = wanted(params.mode ?? "toggle", media.loop, ["on"], ["off"]);
      return;
    case "controls":
      player.toggleAttribute(
        "data-controls-off",
        !wanted(
          params.mode ?? "toggle",
          !player.hasAttribute("data-controls-off"),
          ["show"],
          ["hide"]
        )
      );
      return;
    case "captions": {
      const track = captionTrack(media);
      if (!track) throw new PlayerError("no-captions", "This video has no captions file.");
      track.mode = wanted(params.mode ?? "toggle", track.mode === "showing", ["show"], ["hide"])
        ? "showing"
        : "hidden";
      return;
    }
    case "fullscreen": {
      const now = document.fullscreenElement === player;
      const go = wanted(params.mode ?? "toggle", now, ["on"], ["off"]);
      if (go === now) return;
      if (!go) return document.exitFullscreen();
      if (!player.requestFullscreen)
        throw new PlayerError("no-fullscreen", "This browser cannot show it full screen.");
      return player.requestFullscreen().catch(() => {
        throw new PlayerError(
          "blocked",
          "The browser blocked full screen until the visitor clicks."
        );
      });
    }
    case "pip": {
      const video = media as HTMLVideoElement;
      if (!document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== "function")
        throw new PlayerError("no-pip", "This browser cannot open Picture in Picture.");
      const now = document.pictureInPictureElement === video;
      const go = wanted(params.mode ?? "toggle", now, ["on"], ["off"]);
      if (go === now) return;
      await (go ? video.requestPictureInPicture() : document.exitPictureInPicture());
      return;
    }
    case "source": {
      const src = safeUrl(params.src ?? "");
      if (src === "")
        throw new PlayerError(
          "no-source",
          "The source must be an http(s) address or a path of this site."
        );
      media.src = src;
      if (params.poster !== undefined && "poster" in media)
        (media as HTMLVideoElement).poster = safeUrl(params.poster);
      media.load();
      if (params.play === "true") await play(media);
      return;
    }
    default:
      throw new PlayerError("unknown-command", "The player has no such command.");
  }
}
