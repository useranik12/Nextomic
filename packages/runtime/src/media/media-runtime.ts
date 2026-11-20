import { clockText } from "@nextomic/schema";
import { PLAYER, mediaOf, mountPlayer, playerOf, runCommand, syncPlayer } from "./player";

// The Video and Audio players of a page (docs/elements.md "Video and Audio"). Listeners sit on the
// document and find the player from the event, so players drawn again after a redraw keep working
// with no new binding. Media events do not bubble, so they are caught on the way down.

const IDLE_MS = 2500;
const PERCENT_KEYS = "0123456789";

const MEDIA_EVENTS = [
  "loadedmetadata",
  "durationchange",
  "timeupdate",
  "progress",
  "play",
  "playing",
  "pause",
  "ended",
  "seeking",
  "seeked",
  "waiting",
  "canplay",
  "volumechange",
  "ratechange",
  "emptied",
  "enterpictureinpicture",
  "leavepictureinpicture"
] as const;

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** Starts the players of a document. Returns what stops it. */
export function startMediaRuntime(root: Document = document): () => void {
  const stops: (() => void)[] = [];
  const listen = <K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
    capture = false
  ) => {
    root.addEventListener(type, fn, capture);
    stops.push(() => root.removeEventListener(type, fn, capture));
  };
  const run = (player: HTMLElement, command: string, params?: Record<string, string>) => {
    // A command that fails (blocked autoplay, no captions) leaves the player as it is.
    // Loop and captions fire no media event, so the bar is brought up to date after the command.
    void runCommand(player, command, params)
      .catch(() => undefined)
      .then(() => syncPlayer(player));
  };

  const mountAll = (scope: ParentNode) =>
    scope.querySelectorAll<HTMLElement>(PLAYER).forEach(mountPlayer);
  mountAll(root);
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.matches(PLAYER)) mountPlayer(node as HTMLElement);
        mountAll(node);
      }
  });
  observer.observe(root.documentElement, { childList: true, subtree: true });
  stops.push(() => observer.disconnect());

  // The hidden bar of an idle player comes back with any pointer or key.
  const timers = new WeakMap<Element, number>();
  const wake = (player: HTMLElement) => {
    player.removeAttribute("data-idle");
    window.clearTimeout(timers.get(player));
    if (player.hasAttribute("data-autohide"))
      timers.set(
        player,
        window.setTimeout(() => player.setAttribute("data-idle", ""), IDLE_MS)
      );
  };
  for (const type of ["pointermove", "pointerdown", "keydown", "focusin"] as const)
    listen(type, (e) => {
      const player = playerOf(e.target);
      if (player) wake(player);
    });
  // The state of the bar follows the media element.
  for (const type of MEDIA_EVENTS)
    root.addEventListener(
      type,
      (e) => {
        const player = playerOf(e.target);
        if (!player || e.target !== mediaOf(player)) return;
        syncPlayer(player);
        // The bar of a player that starts by itself hides after the idle time too.
        if (e.type === "playing") wake(player);
      },
      true
    );
  for (const type of ["fullscreenchange"] as const)
    listen(type, () => root.querySelectorAll<HTMLElement>(PLAYER).forEach(syncPlayer));

  listen("pointerout", (e) => {
    const player = playerOf(e.target);
    const into = e.relatedTarget;
    if (player?.hasAttribute("data-autohide") && !(into instanceof Node && player.contains(into)))
      player.setAttribute("data-idle", "");
  });

  listen("click", (e) => {
    const player = playerOf(e.target);
    if (!player || !(e.target instanceof Element)) return;
    const button = e.target.closest<HTMLElement>("[data-nxt-btn]");
    if (button && player.contains(button)) {
      const kind = button.getAttribute("data-nxt-btn") ?? "";
      if (kind === "big") run(player, "play");
      else if (kind === "play") run(player, "toggle");
      else if (kind === "mute") run(player, "mute");
      else if (kind === "loop") run(player, "loop");
      else if (kind === "captions") run(player, "captions");
      else if (kind === "pip") run(player, "pip");
      else if (kind === "fullscreen") run(player, "fullscreen");
      else if (kind === "speed") run(player, "nextSpeed");
      else if (kind === "back" || kind === "forward") {
        const seconds = Number(button.getAttribute("data-skip")) || 10;
        run(player, "skip", { seconds: String(kind === "back" ? -seconds : seconds) });
      }
      return;
    }
    if (player.hasAttribute("data-click") && e.target.matches("[data-nxt-el]"))
      run(player, "toggle");
  });
  listen("dblclick", (e) => {
    const player = playerOf(e.target);
    if (
      player?.getAttribute("data-kind") === "video" &&
      e.target instanceof Element &&
      e.target.matches("[data-nxt-el]")
    )
      run(player, "fullscreen");
  });

  // The seek bar and the volume slider: a real range input lies over them.
  listen("input", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.matches("[data-nxt-slider]")) return;
    const player = playerOf(input);
    const media = player && mediaOf(player);
    if (!player || !media) return;
    const value = Number(input.value);
    if (input.getAttribute("data-nxt-slider") === "seek") {
      if (Number.isFinite(media.duration)) media.currentTime = (value / 1000) * media.duration;
    } else {
      media.volume = value / 100;
      media.muted = value === 0;
    }
    syncPlayer(player);
  });
  listen("pointerdown", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.matches("[data-nxt-slider]"))
      e.target.setAttribute("data-dragging", "");
  });
  listen("pointerup", () =>
    root.querySelectorAll("[data-dragging]").forEach((el) => el.removeAttribute("data-dragging"))
  );
  listen("pointermove", (e) => {
    const seek =
      e.target instanceof Element ? e.target.closest<HTMLElement>("[data-nxt-seek]") : null;
    const player = playerOf(seek);
    const media = player && mediaOf(player);
    const tip = seek?.querySelector<HTMLElement>("[data-nxt-tip]");
    if (!seek || !media || !tip || !Number.isFinite(media.duration)) return;
    const box = seek.getBoundingClientRect();
    const x = Math.min(box.width, Math.max(0, e.clientX - box.left));
    tip.style.setProperty("--nxt-tip-x", `${x}px`);
    tip.textContent = clockText((x / (box.width || 1)) * media.duration);
  });

  // Keys work only while the player (or something in it) has the focus.
  listen("keydown", (e) => {
    const player = playerOf(e.target);
    if (!player || !player.hasAttribute("data-keys") || e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target;
    const onControl = target instanceof HTMLElement && target.matches("button,a,[data-nxt-slider]");
    if (isEditable(target) && !(target as HTMLElement).matches("[data-nxt-slider]")) return;
    const skip = Number(player.getAttribute("data-skip")) || 10;
    const key = e.key;
    let handled = true;
    if ((key === " " || key === "Enter") && onControl) handled = false;
    else if (key === " " || key === "k") run(player, "toggle");
    else if (key === "ArrowLeft" && !(target as HTMLElement).matches("[data-nxt-slider]"))
      run(player, "skip", { seconds: String(-skip) });
    else if (key === "ArrowRight" && !(target as HTMLElement).matches("[data-nxt-slider]"))
      run(player, "skip", { seconds: String(skip) });
    else if (key === "m") run(player, "mute");
    else if (key === "f" && player.getAttribute("data-kind") === "video") run(player, "fullscreen");
    else if (key === "c" && player.getAttribute("data-kind") === "video") run(player, "captions");
    else if (key === "Home") run(player, "seek", { mode: "percent", value: "0" });
    else if (key === "End") run(player, "seek", { mode: "percent", value: "100" });
    else if (PERCENT_KEYS.includes(key) && key.length === 1)
      run(player, "seek", { mode: "percent", value: String(Number(key) * 10) });
    else handled = false;
    if (handled) e.preventDefault();
  });

  return () => stops.splice(0).forEach((stop) => stop());
}
