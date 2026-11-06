import { planAnimation, type Animation, type Timeline } from "@nextomic/schema";
import type { gsap as Gsap } from "gsap";

// Builds GSAP timelines from the project animation data and starts them on the page. The editor
// preview uses `previewTimeline` (no triggers, controlled by the host); built pages use
// `startTimelines` (scroll, load, click, hover and custom triggers).

type GsapApi = typeof Gsap;
type GsapTimeline = ReturnType<GsapApi["timeline"]>;
type SplitTextApi = { create: (targets: unknown, vars: object) => SplitInstance };
interface SplitInstance {
  chars: Element[];
  words: Element[];
  lines: Element[];
  revert: () => void;
}

interface Engine {
  gsap: GsapApi;
  splitText: SplitTextApi | null;
}

let enginePromise: Promise<Engine> | null = null;

/** Loads GSAP once, with ScrollTrigger and SplitText (both are free in the gsap package). */
export function loadEngine(): Promise<Engine> {
  enginePromise ??= (async () => {
    const [core, scroll, split] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("gsap/SplitText")
    ]);
    const gsap = core.gsap;
    gsap.registerPlugin(scroll.ScrollTrigger, split.SplitText);
    return { gsap, splitText: split.SplitText as unknown as SplitTextApi };
  })();
  return enginePromise;
}

const registry = new Map<string, GsapTimeline>();

/** A started timeline by id, for actions that play, pause or reverse it (the "custom" trigger). */
export function getTimeline(id: string): GsapTimeline | undefined {
  return registry.get(id);
}

function resolveTargets(selector: string, trigger: Element, root: ParentNode): Element[] {
  if (selector.trim() === "" || selector === "this") return [trigger];
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function addTweens(
  engine: Engine,
  tl: GsapTimeline,
  animations: readonly Animation[],
  trigger: Element,
  root: ParentNode,
  splits: SplitInstance[]
): void {
  for (const animation of animations) {
    let targets: Element[] = resolveTargets(animation.selector, trigger, root);
    if (targets.length === 0) continue;
    if (animation.splitText.enabled && engine.splitText) {
      const split = engine.splitText.create(targets, { type: animation.splitText.type });
      splits.push(split);
      targets = split[animation.splitText.type];
    }
    const plan = planAnimation(animation);
    const vars = { ...plan.to, data: animation.id };
    const at = plan.position;
    if (plan.method === "fromTo") tl.fromTo(targets, plan.from, vars, at);
    else if (plan.method === "from") tl.from(targets, vars, at);
    else if (plan.method === "set") tl.set(targets, vars, at);
    else tl.to(targets, vars, at);
  }
}

function matchesAny(target: EventTarget | null, selectors: string): boolean {
  if (!selectors.trim() || !(target instanceof Element)) return false;
  try {
    return target.closest(selectors) !== null;
  } catch {
    return false;
  }
}

function wireInteraction(
  timeline: Timeline,
  tl: GsapTimeline,
  trigger: Element,
  root: ParentNode,
  cleanups: (() => void)[]
): void {
  const { interaction } = timeline;
  tl.timeScale(interaction.timeScale);
  const on = (el: Element | Document, type: string, handler: (event: Event) => void) => {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  };

  if (timeline.trigger === "click") {
    on(trigger, "click", (event) => {
      if (matchesAny(event.target, interaction.excludedSelectors)) return;
      if (interaction.reverse && tl.progress() > 0 && !tl.reversed()) tl.reverse();
      else tl.play();
    });
    if (interaction.reverseSelector) {
      for (const el of resolveTargets(interaction.reverseSelector, trigger, root)) {
        on(el, "click", () => void tl.reverse());
      }
    }
    if (interaction.reverseOutside) {
      on(document, "click", (event) => {
        if (trigger.contains(event.target as Node)) return;
        if (tl.progress() > 0) tl.reverse();
      });
    }
  } else if (timeline.trigger === "hover") {
    on(trigger, "mouseenter", (event) => {
      if (!matchesAny(event.target, interaction.excludedSelectors)) tl.play();
    });
    if (interaction.reverse) on(trigger, "mouseleave", () => void tl.reverse());
  }
}

function buildOne(
  engine: Engine,
  timeline: Timeline,
  trigger: Element,
  root: ParentNode,
  cleanups: (() => void)[]
): void {
  const st = timeline.scrollTrigger;
  const config: Record<string, unknown> = { repeat: timeline.repeat };
  if (timeline.trigger === "scroll") {
    config.scrollTrigger = {
      trigger,
      start: st.start,
      end: st.end,
      toggleActions: st.toggleActions,
      scrub: st.scrub ? st.scrubSmooth || true : false,
      pin: st.pin ? trigger : false,
      pinSpacing: st.pinSpacing,
      markers: st.markers,
      ...(st.toggleClass.enabled
        ? {
            toggleClass: {
              targets: resolveTargets(st.toggleClass.selector, trigger, root),
              className: st.toggleClass.className
            }
          }
        : {}),
      ...(st.snap.enabled
        ? { snap: { snapTo: st.snap.to, duration: st.snap.duration, delay: st.snap.delay } }
        : {})
    };
  } else if (timeline.trigger !== "load") {
    config.paused = true;
  }
  const tl = engine.gsap.timeline(config);
  const splits: SplitInstance[] = [];
  addTweens(engine, tl, timeline.animations, trigger, root, splits);
  registry.set(timeline.id, tl);
  wireInteraction(timeline, tl, trigger, root, cleanups);
  cleanups.push(() => {
    tl.scrollTrigger?.kill();
    tl.kill();
    for (const split of splits) split.revert();
    if (registry.get(timeline.id) === tl) registry.delete(timeline.id);
  });
}

export interface PlayerHandle {
  destroy: () => void;
}

/** Starts the timelines on a page. The handle undoes everything (for route changes). */
export async function startTimelines(
  timelines: readonly Timeline[],
  root: ParentNode = document
): Promise<PlayerHandle> {
  const engine = await loadEngine();
  const cleanups: (() => void)[] = [];
  const media = engine.gsap.matchMedia();
  for (const timeline of timelines) {
    if (!timeline.enabled || timeline.animations.length === 0) continue;
    const build = () => {
      const local: (() => void)[] = [];
      const triggers = timeline.triggerSelector
        ? resolveTargets(timeline.triggerSelector, document.body, root)
        : [document.body];
      for (const trigger of triggers) buildOne(engine, timeline, trigger, root, local);
      return () => local.forEach((fn) => fn());
    };
    if (timeline.matchMedia.trim()) media.add(timeline.matchMedia, build);
    else cleanups.push(build());
  }
  return {
    destroy: () => {
      media.revert();
      cleanups.forEach((fn) => fn());
    }
  };
}

export interface PreviewHandle {
  /** All values are seconds. */
  duration: () => number;
  time: () => number;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  /** Back to the start, with the styles GSAP set removed from the elements. */
  stop: () => void;
  destroy: () => void;
  onUpdate: (listener: (seconds: number, playing: boolean) => void) => void;
}

/** A paused copy of the timeline for the editor: no scroll or event triggers, the host drives it. */
export async function previewTimeline(
  timeline: Timeline,
  root: ParentNode = document
): Promise<PreviewHandle> {
  const engine = await loadEngine();
  const trigger = timeline.triggerSelector
    ? (resolveTargets(timeline.triggerSelector, document.body, root)[0] ?? document.body)
    : document.body;
  const tl = engine.gsap.timeline({ paused: true });
  const splits: SplitInstance[] = [];
  addTweens(engine, tl, timeline.animations, trigger, root, splits);
  const touched = new Set<Element>();
  for (const child of tl.getChildren(false)) {
    const targets = (child as { targets?: () => unknown[] }).targets?.() ?? [];
    for (const target of targets) if (target instanceof Element) touched.add(target);
  }
  const clear = () => void engine.gsap.set([...touched], { clearProps: "all" });
  return {
    duration: () => tl.duration(),
    time: () => tl.time(),
    play: () => {
      if (tl.progress() === 1) tl.restart();
      else tl.play();
    },
    pause: () => void tl.pause(),
    seek: (seconds) => void tl.pause().time(Math.min(Math.max(0, seconds), tl.duration())),
    stop: () => {
      tl.pause().time(0);
      clear();
    },
    destroy: () => {
      tl.kill();
      clear();
      for (const split of splits) split.revert();
    },
    onUpdate: (listener) => {
      tl.eventCallback("onUpdate", () => listener(tl.time(), tl.isActive()));
      tl.eventCallback("onComplete", () => listener(tl.time(), false));
    }
  };
}
