import { z } from "zod";

// Animations (docs/design-system.md section 9). Folders hold timelines, timelines hold animations.
// A timeline is a GSAP timeline, an animation is a GSAP tween. Everything is plain data: the editor
// edits it, the runtime (`packages/runtime`) builds GSAP timelines from it, and `timelineToGsapCode`
// prints the equivalent GSAP code for people who want to read or copy it.

export const ANIMATION_METHODS = ["to", "from", "fromTo", "set"] as const;
export const TIMELINE_TRIGGERS = ["scroll", "load", "click", "hover", "custom"] as const;
export const TOGGLE_ACTIONS = [
  "play",
  "pause",
  "resume",
  "reset",
  "restart",
  "complete",
  "reverse",
  "none"
] as const;

export const GSAP_EASES = [
  "none",
  "power1.in",
  "power1.out",
  "power1.inOut",
  "power2.in",
  "power2.out",
  "power2.inOut",
  "power3.in",
  "power3.out",
  "power3.inOut",
  "power4.in",
  "power4.out",
  "power4.inOut",
  "back.in(1.7)",
  "back.out(1.7)",
  "back.inOut(1.7)",
  "elastic.in(1,0.3)",
  "elastic.out(1,0.3)",
  "elastic.inOut(1,0.3)",
  "bounce.in",
  "bounce.out",
  "bounce.inOut",
  "circ.in",
  "circ.out",
  "circ.inOut",
  "expo.in",
  "expo.out",
  "expo.inOut",
  "sine.in",
  "sine.out",
  "sine.inOut",
  "steps(12)"
] as const;

/** A GSAP ease string such as `power2.out`, `back.out(1.7)` or `steps(12)`. */
const easeSchema = z
  .string()
  .max(80)
  .regex(/^[A-Za-z0-9_.(), -]*$/, "Use a GSAP ease such as power2.out");

/** A selector for the targets: `this` (the trigger), or CSS such as `.card`, `#nxtomc-ab12cd34`, `h1`. */
const selectorSchema = z
  .string()
  .max(300)
  .refine((v) => !/[{};<>]/.test(v), "That selector has characters that are not allowed");

const propertyValue = z.union([z.string().max(300), z.number()]);

/** Property names GSAP accepts for a tween: x, y, rotation, scale, opacity, backgroundColor, ... */
export const ANIMATION_PROPERTY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const propertiesSchema = z
  .record(z.string().regex(ANIMATION_PROPERTY_PATTERN).max(48), propertyValue)
  .default({});

export const animationSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(80).default(""),
  method: z.enum(ANIMATION_METHODS).default("to"),
  selector: selectorSchema.default("this"),
  duration: z.number().min(0).max(600).default(1),
  delay: z.number().min(0).max(600).default(0),
  // -1 repeats forever.
  repeat: z.number().int().min(-1).max(1000).default(0),
  ease: easeSchema.default("power2.out"),
  yoyo: z.boolean().default(false),
  // Where the animation starts on the timeline: right after the previous one, with it, or custom
  // (a time such as 3, or +=1, -=0.5, <, <+=0.3, >-0.5).
  position: z
    .object({
      mode: z.enum(["end", "start", "custom"]).default("end"),
      value: z
        .string()
        .max(24)
        .regex(/^[0-9a-zA-Z.+\-=<>% ]*$/)
        .default("")
    })
    .default({}),
  // The values the animation moves to (and from, for the "from" and "fromTo" methods).
  properties: propertiesSchema,
  fromProperties: propertiesSchema,
  // Extra GSAP vars as JSON, merged over the visual properties.
  vars: z.string().max(5000).default(""),
  splitText: z
    .object({
      enabled: z.boolean().default(false),
      type: z.enum(["chars", "words", "lines"]).default("chars")
    })
    .default({}),
  stagger: z
    .object({
      enabled: z.boolean().default(false),
      amount: z.number().min(0).max(60).default(0.02),
      from: z.enum(["start", "end", "center", "edges", "random"]).default("start"),
      ease: easeSchema.default("none")
    })
    .default({})
});
export type Animation = z.infer<typeof animationSchema>;

const toggleActionsSchema = z
  .string()
  .max(80)
  .regex(
    /^(?:(?:play|pause|resume|reset|restart|complete|reverse|none) ){3}(?:play|pause|resume|reset|restart|complete|reverse|none)$/,
    "Four actions"
  )
  .default("play none none none");

const scrollPoint = z
  .string()
  .max(60)
  .regex(/^[0-9a-zA-Z.+\-=% ()]*$/);

export const scrollTriggerSchema = z.object({
  start: scrollPoint.default("top 80%"),
  end: scrollPoint.default("bottom top"),
  toggleActions: toggleActionsSchema,
  scrub: z.boolean().default(false),
  // Seconds the animation takes to catch up with the scrollbar.
  scrubSmooth: z.number().min(0).max(10).default(1),
  pin: z.boolean().default(false),
  pinSpacing: z.boolean().default(true),
  markers: z.boolean().default(false),
  toggleClass: z
    .object({
      enabled: z.boolean().default(false),
      selector: selectorSchema.default("this"),
      className: z
        .string()
        .max(64)
        .regex(/^[A-Za-z_-][\w-]*$/)
        .default("active")
    })
    .default({}),
  snap: z
    .object({
      enabled: z.boolean().default(false),
      to: z.number().min(0).max(1).default(0.33),
      duration: z.number().min(0).max(5).default(0.3),
      delay: z.number().min(0).max(5).default(0.1)
    })
    .default({})
});
export type ScrollTriggerSettings = z.infer<typeof scrollTriggerSchema>;

export const timelineSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  folderId: z.string().max(64).nullable().default(null),
  enabled: z.boolean().default(true),
  trigger: z.enum(TIMELINE_TRIGGERS).default("scroll"),
  // The element that starts the timeline. Every match gets its own timeline.
  triggerSelector: selectorSchema.default(""),
  // Only run when this media query matches, e.g. (min-width: 768px).
  matchMedia: z
    .string()
    .max(200)
    .regex(/^[^{};<>]*$/)
    .default(""),
  // Pages the timeline runs on; empty means every page.
  pageIds: z.array(z.string().max(64)).max(500).default([]),
  // 0 = once, -1 = forever.
  repeat: z.number().int().min(-1).max(1000).default(0),
  scrollTrigger: scrollTriggerSchema.default({}),
  // Click and hover.
  interaction: z
    .object({
      reverse: z.boolean().default(false),
      reverseSelector: selectorSchema.default(""),
      reverseOutside: z.boolean().default(false),
      excludedSelectors: z.string().max(300).default(""),
      timeScale: z.number().min(0.1).max(10).default(1)
    })
    .default({}),
  animations: z.array(animationSchema).max(200).default([])
});
export type Timeline = z.infer<typeof timelineSchema>;

export const animationFolderSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(48)
});
export type AnimationFolder = z.infer<typeof animationFolderSchema>;

export const animationSettingsSchema = z.object({
  folders: z.array(animationFolderSchema).max(100).default([]),
  timelines: z.array(timelineSchema).max(300).default([])
});
export type AnimationSettings = z.infer<typeof animationSettingsSchema>;

export const emptyAnimationSettings = (): AnimationSettings => ({ folders: [], timelines: [] });

/** A new animation with sensible defaults. */
export function newAnimation(id: string, name: string): Animation {
  return animationSchema.parse({
    id,
    name,
    position: {},
    splitText: {},
    stagger: {},
    properties: { opacity: 0, y: 40 },
    method: "from"
  });
}

/** A new, empty timeline. */
export function newTimeline(id: string, name: string, folderId: string | null = null): Timeline {
  return timelineSchema.parse({
    id,
    name,
    folderId,
    scrollTrigger: {},
    interaction: {},
    animations: []
  });
}

/** Timelines that run on a page: enabled and not limited to other pages. */
export function timelinesForPage(
  settings: Pick<AnimationSettings, "timelines">,
  pageId: string | null
): Timeline[] {
  return settings.timelines.filter(
    (t) =>
      t.enabled &&
      t.animations.length > 0 &&
      (t.pageIds.length === 0 || (pageId !== null && t.pageIds.includes(pageId)))
  );
}

/** Parses the advanced vars text. Empty is fine; anything but a plain JSON object is an error. */
export function parseAnimationVars(
  text: string
): { ok: true; vars: Record<string, unknown> } | { ok: false; error: string } {
  if (text.trim() === "") return { ok: true, vars: {} };
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: 'Vars must be a JSON object such as { "rotation": 90 }.' };
    }
    return { ok: true, vars: value as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Vars is not valid JSON. Keys and text values need double quotes." };
  }
}

/** Numbers stay numbers (`"40"` becomes 40) and text such as `50%` or `#fff` stays text. */
function propertyVars(
  properties: Record<string, string | number>
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(properties)) {
    out[key] =
      typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
        ? Number(value)
        : value;
  }
  return out;
}

export interface TweenPlan {
  method: Animation["method"];
  selector: string;
  /** The "from" values for fromTo. */
  from: Record<string, unknown>;
  /** The "to" values (or the only values for to, from, set), with timing and stagger. */
  to: Record<string, unknown>;
  /** The GSAP position argument, or undefined for "right after the previous". */
  position: string | number | undefined;
}

/** The exact GSAP arguments for one animation. The runtime, the preview and the code view share this. */
export function planAnimation(animation: Animation): TweenPlan {
  const advanced = parseAnimationVars(animation.vars);
  const extra = advanced.ok ? advanced.vars : {};
  const base: Record<string, unknown> = { ...propertyVars(animation.properties), ...extra };
  if (animation.method !== "set") {
    base.duration = animation.duration;
    if (animation.delay > 0) base.delay = animation.delay;
    base.ease = animation.ease;
    if (animation.repeat !== 0) base.repeat = animation.repeat;
    if (animation.yoyo) base.yoyo = true;
    if (animation.stagger.enabled) {
      base.stagger =
        animation.stagger.from === "start" && animation.stagger.ease === "none"
          ? animation.stagger.amount
          : {
              amount: animation.stagger.amount,
              from: animation.stagger.from,
              ease: animation.stagger.ease
            };
    }
  }
  const { mode, value } = animation.position;
  const trimmed = value.trim();
  const position =
    mode === "start"
      ? "<"
      : mode === "custom" && trimmed !== ""
        ? !Number.isNaN(Number(trimmed))
          ? Number(trimmed)
          : trimmed
        : undefined;
  return {
    method: animation.method,
    selector: animation.selector,
    from: animation.method === "fromTo" ? propertyVars(animation.fromProperties) : {},
    to: base,
    position
  };
}

const json = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:");

/** The GSAP code a timeline stands for, for the "GSAP Code" view. Read-only; copy it anywhere. */
export function timelineToGsapCode(timeline: Timeline): string {
  const lines: string[] = [];
  const st = timeline.scrollTrigger;
  const config: Record<string, unknown> = {};
  if (timeline.repeat !== 0) config.repeat = timeline.repeat;
  if (timeline.trigger === "scroll") {
    config.scrollTrigger = {
      trigger: timeline.triggerSelector || "this",
      start: st.start,
      end: st.end,
      toggleActions: st.toggleActions,
      ...(st.scrub ? { scrub: st.scrubSmooth || true } : {}),
      ...(st.pin ? { pin: true, pinSpacing: st.pinSpacing } : {}),
      ...(st.markers ? { markers: true } : {})
    };
  } else if (timeline.trigger !== "load") {
    config.paused = true;
  }
  lines.push(`const tl = gsap.timeline(${Object.keys(config).length ? json(config) : ""});`);
  for (const animation of timeline.animations) {
    const plan = planAnimation(animation);
    const target = JSON.stringify(plan.selector === "this" ? "this" : plan.selector);
    const position = plan.position === undefined ? "" : `, ${JSON.stringify(plan.position)}`;
    const args = plan.method === "fromTo" ? `${json(plan.from)}, ${json(plan.to)}` : json(plan.to);
    lines.push(`tl.${plan.method}(${target}, ${args}${position});`);
  }
  if (timeline.trigger === "click")
    lines.push(`// click ${timeline.triggerSelector || "this"} -> tl.play()`);
  if (timeline.trigger === "hover")
    lines.push(`// hover ${timeline.triggerSelector || "this"} -> tl.play()`);
  if (timeline.trigger === "custom") lines.push(`// started by an action: tl.play()`);
  return lines.join("\n");
}

export interface AnimationSlot {
  id: string;
  /** Seconds from the start of the timeline. */
  start: number;
  /** Seconds the bar covers: delay, duration and repeats (stagger adds to this at run time). */
  length: number;
}

const OFFSET = /^([<>]?)(?:([+-])=)?(-?\d*\.?\d+)?$/;

/**
 * Where each animation sits on the timeline, worked out the way GSAP does it for the position
 * parameter: a number is absolute, `+=1` and `-=1` are from the end, `<` and `>` are the start and
 * end of the previous animation. Used by the editor's timeline bars.
 */
export function layoutAnimations(animations: readonly Animation[]): AnimationSlot[] {
  const slots: AnimationSlot[] = [];
  let timelineEnd = 0;
  let previousStart = 0;
  let previousEnd = 0;
  for (const animation of animations) {
    const { mode, value } = animation.position;
    const text = value.trim();
    let start = timelineEnd;
    if (mode === "start") start = previousStart;
    else if (mode === "custom" && text !== "") {
      const m = OFFSET.exec(text);
      if (m) {
        const [, anchor, sign, amountText] = m;
        const amount = amountText === undefined ? 0 : Number(amountText);
        const signed = sign === "-" ? -amount : amount;
        if (anchor === "<") start = previousStart + signed;
        else if (anchor === ">") start = previousEnd + signed;
        else if (sign) start = timelineEnd + signed;
        else start = amount;
      }
    }
    start = Math.max(0, start);
    const cycles = animation.repeat < 0 ? 1 : animation.repeat + 1;
    const length = animation.method === "set" ? 0 : animation.delay + animation.duration * cycles;
    slots.push({ id: animation.id, start, length });
    previousStart = start;
    previousEnd = start + length;
    timelineEnd = Math.max(timelineEnd, previousEnd);
  }
  return slots;
}

/** Total length of a timeline in seconds. */
export function timelineLength(animations: readonly Animation[]): number {
  return layoutAnimations(animations).reduce((end, s) => Math.max(end, s.start + s.length), 0);
}
