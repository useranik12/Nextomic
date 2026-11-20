import type { Params, TriggerFlow } from "@nextomic/schema";

// Triggers of the Video and Audio players (docs/elements.md "Video and Audio"). Media events do not
// bubble, so they are caught on the way down and matched to the element that owns the player.

const EVENTS: readonly [string, string][] = [
  ["loadedmetadata", "loaded"],
  ["play", "played"],
  ["pause", "paused"],
  ["ended", "ended"],
  ["seeked", "seeked"],
  ["error", "loadError"]
];

interface Binding {
  flowOf: (nodeId: string, trigger: string) => TriggerFlow | undefined;
  fire: (nodeId: string, flow: TriggerFlow) => void;
  seconds: (settings: Params) => number;
}

/** Listens for the media events of the page; returns what stops it. */
export function bindMediaTriggers({ flowOf, fire, seconds }: Binding): () => void {
  const stops: (() => void)[] = [];
  const reached = new WeakSet<Element>();
  const owner = (target: EventTarget | null) => {
    const player =
      target instanceof Element ? target.closest<HTMLElement>("[data-nxt-media]") : null;
    const id = player?.getAttribute("data-nid") ?? "";
    return player && id ? { player, id, kind: player.getAttribute("data-kind") ?? "video" } : null;
  };
  const on = (type: string, fn: (e: Event) => void) => {
    document.addEventListener(type, fn, true);
    stops.push(() => document.removeEventListener(type, fn, true));
  };
  const fireFor = (target: EventTarget | null, name: string) => {
    const hit = owner(target);
    const flow = hit && flowOf(hit.id, `${hit.kind}.${name}`);
    if (hit && flow) fire(hit.id, flow);
  };
  for (const [type, name] of EVENTS)
    on(type, (e) => {
      if (!(e.target instanceof HTMLMediaElement)) return;
      // A file that plays to the end also pauses; only "ended" is reported then.
      if (type === "pause" && e.target.ended) return;
      fireFor(e.target, name);
    });
  on("nxt-stopped", (e) => fireFor(e.target, "stopped"));
  // Played Length fires once each time the played time passes the seconds set.
  on("timeupdate", (e) => {
    const media = e.target;
    const hit = media instanceof HTMLMediaElement ? owner(media) : null;
    const flow = hit && flowOf(hit.id, `${hit.kind}.playedLength`);
    if (!hit || !flow || !(media instanceof HTMLMediaElement)) return;
    const limit = seconds(flow.settings);
    if (media.currentTime < limit) reached.delete(media);
    else if (!reached.has(media)) {
      reached.add(media);
      fire(hit.id, flow);
    }
  });
  return () => stops.splice(0).forEach((stop) => stop());
}
