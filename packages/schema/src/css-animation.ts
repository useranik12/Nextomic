import { z } from "zod";

// CSS animations on an element (Design tab > Animations). A ready-made keyframe animation plays on
// a target when a trigger fires. The runtime (`packages/runtime/src/css-animations.ts`) wires the
// triggers; this file holds the data, the animation library and the keyframes CSS.

export const CSS_ANIMATION_TRIGGERS = [
  "click",
  "hover",
  "focus",
  "enter-view",
  "leave-view",
  "scroll",
  "load"
] as const;
export type CssAnimationTrigger = (typeof CSS_ANIMATION_TRIGGERS)[number];

export const CSS_ANIMATION_TRIGGER_LABELS: Record<CssAnimationTrigger, string> = {
  click: "Click",
  hover: "Hover",
  focus: "Focus",
  "enter-view": "Enter view",
  "leave-view": "Leave view",
  scroll: "Scroll",
  load: "Content loaded"
};

const selectorSchema = z
  .string()
  .max(300)
  .refine((v) => !/[{};<>]/.test(v), "That selector has characters that are not allowed");

export const elementAnimationSchema = z.object({
  trigger: z.enum(CSS_ANIMATION_TRIGGERS).default("load"),
  // Empty: the element itself. Otherwise a CSS selector; every match listens.
  triggerSelector: selectorSchema.default(""),
  // Milliseconds between the trigger and the start.
  delay: z.number().min(0).max(60_000).default(0),
  // Scroll trigger only: pixels scrolled before it plays.
  scrollOffset: z.number().min(0).max(1_000_000).default(0),
  // Id from CSS_ANIMATIONS; empty means none chosen yet.
  animation: z.string().max(40).default(""),
  // Seconds.
  duration: z.number().min(0.05).max(60).default(1),
  target: z.enum(["self", "selector"]).default("self"),
  targetSelector: selectorSchema.default(""),
  // Plays once per browser session.
  once: z.boolean().default(false)
});
export type ElementAnimation = z.infer<typeof elementAnimationSchema>;

export const newElementAnimation = (): ElementAnimation => elementAnimationSchema.parse({});

export interface CssAnimationDef {
  id: string;
  label: string;
  group: string;
  /** Starts hidden: the element is invisible until the animation plays. */
  entrance: boolean;
  /** Keyframe steps, e.g. `0%{opacity:0}100%{opacity:1}`. */
  frames: string;
}

const T = (value: string): string => `transform:${value}`;
const kebab = (name: string): string => name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
const words = (name: string): string => {
  const text = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const defs: CssAnimationDef[] = [];
function add(name: string, group: string, entrance: boolean, frames: string, label?: string): void {
  defs.push({ id: kebab(name), label: label ?? words(name), group, entrance, frames });
}

// Attention seekers.
const O = (origin: string) => `transform-origin:${origin};`;
add(
  "bounce",
  "Attention",
  false,
  `0%,20%,53%,100%{${O("center bottom")}${T("translate3d(0,0,0)")}}40%,43%{${T("translate3d(0,-30px,0) scaleY(1.1)")}}70%{${T("translate3d(0,-15px,0) scaleY(1.05)")}}80%{${T("translate3d(0,0,0) scaleY(.95)")}}90%{${T("translate3d(0,-4px,0) scaleY(1.02)")}}`
);
add("flash", "Attention", false, "0%,50%,100%{opacity:1}25%,75%{opacity:0}");
add(
  "rubberBand",
  "Attention",
  false,
  `0%{${T("scale3d(1,1,1)")}}30%{${T("scale3d(1.25,.75,1)")}}40%{${T("scale3d(.75,1.25,1)")}}50%{${T("scale3d(1.15,.85,1)")}}65%{${T("scale3d(.95,1.05,1)")}}75%{${T("scale3d(1.05,.95,1)")}}100%{${T("scale3d(1,1,1)")}}`,
  "Rubber band"
);
const shake = (axis: "x" | "y") => {
  const at = (px: number) =>
    T(axis === "x" ? `translate3d(${px}px,0,0)` : `translate3d(0,${px}px,0)`);
  return `0%,100%{${at(0)}}10%,30%,50%,70%,90%{${at(-10)}}20%,40%,60%,80%{${at(10)}}`;
};
add("shake", "Attention", false, shake("x"));
add("shakeX", "Attention", false, shake("x"), "Shake X");
add("shakeY", "Attention", false, shake("y"), "Shake Y");
add(
  "swing",
  "Attention",
  false,
  `20%{${O("top center")}${T("rotate3d(0,0,1,15deg)")}}40%{${T("rotate3d(0,0,1,-10deg)")}}60%{${T("rotate3d(0,0,1,5deg)")}}80%{${T("rotate3d(0,0,1,-5deg)")}}100%{${T("rotate3d(0,0,1,0deg)")}}`
);
add(
  "tada",
  "Attention",
  false,
  `0%,100%{${T("scale3d(1,1,1)")}}10%,20%{${T("scale3d(.9,.9,.9) rotate3d(0,0,1,-3deg)")}}30%,50%,70%,90%{${T("scale3d(1.1,1.1,1.1) rotate3d(0,0,1,3deg)")}}40%,60%,80%{${T("scale3d(1.1,1.1,1.1) rotate3d(0,0,1,-3deg)")}}`
);
add(
  "wobble",
  "Attention",
  false,
  `0%,100%{${T("translate3d(0,0,0)")}}15%{${T("translate3d(-25%,0,0) rotate3d(0,0,1,-5deg)")}}30%{${T("translate3d(20%,0,0) rotate3d(0,0,1,3deg)")}}45%{${T("translate3d(-15%,0,0) rotate3d(0,0,1,-3deg)")}}60%{${T("translate3d(10%,0,0) rotate3d(0,0,1,2deg)")}}75%{${T("translate3d(-5%,0,0) rotate3d(0,0,1,-1deg)")}}`
);
const skew = (deg: number) => T(`skewX(${deg}deg) skewY(${deg}deg)`);
add(
  "jello",
  "Attention",
  false,
  `0%,11.1%,100%{${T("translate3d(0,0,0)")}}22.2%{${skew(-12.5)}}33.3%{${skew(6.25)}}44.4%{${skew(-3.125)}}55.5%{${skew(1.5625)}}66.6%{${skew(-0.78125)}}77.7%{${skew(0.390625)}}88.8%{${skew(-0.1953125)}}`
);
add(
  "heartbeat",
  "Attention",
  false,
  `0%{${T("scale(1)")}}14%{${T("scale(1.3)")}}28%{${T("scale(1)")}}42%{${T("scale(1.3)")}}70%{${T("scale(1)")}}`,
  "Heartbeat"
);

// Directional families. Distances follow Animate.css.
type Dir = "Down" | "Up" | "Right" | "Left";
const DIRS: Dir[] = ["Down", "Up", "Right", "Left"];
/** The side an element comes from (in) or leaves toward (out), as an x, y direction. */
const IN: Record<Dir, [number, number]> = {
  Down: [0, -1],
  Up: [0, 1],
  Right: [1, 0],
  Left: [-1, 0]
};
const OUT: Record<Dir, [number, number]> = {
  Down: [0, 1],
  Up: [0, -1],
  Right: [1, 0],
  Left: [-1, 0]
};
const shift = (vec: [number, number], amount: number, unit: string): string => {
  const part = (n: number) => (n === 0 ? "0" : `${n * amount}${unit}`);
  return `translate3d(${part(vec[0])},${part(vec[1])},0)`;
};

function family(
  base: string,
  group: string,
  entrance: boolean,
  plain: string,
  directional: (dir: Dir) => string
): void {
  add(base, group, entrance, plain);
  for (const dir of DIRS) add(`${base}${dir}`, group, entrance, directional(dir));
}

// Fade.
family(
  "fadeIn",
  "Fade in",
  true,
  "0%{opacity:0}100%{opacity:1}",
  (d) => `0%{opacity:0;${T(shift(IN[d], 100, "%"))}}100%{opacity:1;${T("translate3d(0,0,0)")}}`
);
family(
  "fadeOut",
  "Fade out",
  false,
  "0%{opacity:1}100%{opacity:0}",
  (d) => `0%{opacity:1}100%{opacity:0;${T(shift(OUT[d], 100, "%"))}}`
);

// Bounce in and out.
const bounceAxis = (d: Dir) => (d === "Down" || d === "Up" ? "Y" : "X");
const bounceSign = (d: Dir) => (d === "Down" || d === "Left" ? -1 : 1);
family(
  "bounceIn",
  "Bounce in",
  true,
  `0%{opacity:0;${T("scale3d(.3,.3,.3)")}}20%{${T("scale3d(1.1,1.1,1.1)")}}40%{${T("scale3d(.9,.9,.9)")}}60%{opacity:1;${T("scale3d(1.03,1.03,1.03)")}}80%{${T("scale3d(.97,.97,.97)")}}100%{opacity:1;${T("scale3d(1,1,1)")}}`,
  (d) => {
    const a = bounceAxis(d);
    const s = bounceSign(d);
    const tr = (px: number, k: number) =>
      T(`translate3d(${a === "X" ? `${px}px,0` : `0,${px}px`},0) scale${a}(${k})`);
    return `0%{opacity:0;${tr(3000 * s, 3)}}60%{opacity:1;${tr(-25 * s, 1)}}75%{${tr(10 * s, a === "Y" ? 0.95 : 0.98)}}90%{${tr(-5 * s, a === "Y" ? 0.985 : 0.995)}}100%{${T("translate3d(0,0,0)")}}`;
  }
);
family(
  "bounceOut",
  "Bounce out",
  false,
  `20%{${T("scale3d(.9,.9,.9)")}}50%,55%{opacity:1;${T("scale3d(1.1,1.1,1.1)")}}100%{opacity:0;${T("scale3d(.3,.3,.3)")}}`,
  (d) => {
    const a = bounceAxis(d);
    const s = OUT[d][0] + OUT[d][1];
    const tr = (px: number, k: number) =>
      T(`translate3d(${a === "X" ? `${px}px,0` : `0,${px}px`},0) scale${a}(${k})`);
    if (a === "X") {
      return `20%{opacity:1;${tr(-20 * s, 0.9)}}100%{opacity:0;${tr(2000 * s, 2)}}`;
    }
    return `20%{${tr(10 * s, 0.985)}}40%,45%{opacity:1;${tr(-20 * s, 0.9)}}100%{opacity:0;${tr(2000 * s, 3)}}`;
  }
);

// Flip.
const P = "perspective(400px)";
add(
  "flip",
  "Flip",
  false,
  `0%{${T(`${P} scale3d(1,1,1) translate3d(0,0,0) rotate3d(0,1,0,-360deg)`)}}40%{${T(`${P} scale3d(1,1,1) translate3d(0,0,150px) rotate3d(0,1,0,-190deg)`)}}50%{${T(`${P} scale3d(1,1,1) translate3d(0,0,150px) rotate3d(0,1,0,-170deg)`)}}80%{${T(`${P} scale3d(.95,.95,.95) translate3d(0,0,0) rotate3d(0,1,0,0deg)`)}}100%{${T(`${P} scale3d(1,1,1) translate3d(0,0,0) rotate3d(0,1,0,0deg)`)}}`
);
const flipIn = (axis: "1,0,0" | "0,1,0") =>
  `0%{opacity:0;${T(`${P} rotate3d(${axis},90deg)`)}}40%{${T(`${P} rotate3d(${axis},-20deg)`)}}60%{opacity:1;${T(`${P} rotate3d(${axis},10deg)`)}}80%{${T(`${P} rotate3d(${axis},-5deg)`)}}100%{${T(P)}}`;
add("flipX", "Flip", true, flipIn("1,0,0"), "Flip X");
add("flipY", "Flip", true, flipIn("0,1,0"), "Flip Y");

// Rotate.
const rotateIn: Record<string, [string, string]> = {
  "": ["center", "-200deg"],
  DownLeft: ["left bottom", "-45deg"],
  DownRight: ["right bottom", "45deg"],
  UpLeft: ["left bottom", "45deg"],
  UpRight: ["right bottom", "-90deg"]
};
const rotateOut: Record<string, [string, string]> = {
  "": ["center", "200deg"],
  DownLeft: ["left bottom", "45deg"],
  DownRight: ["right bottom", "-45deg"],
  UpLeft: ["left bottom", "-45deg"],
  UpRight: ["right bottom", "90deg"]
};
for (const [side, [origin, deg]] of Object.entries(rotateIn)) {
  add(
    `rotateIn${side}`,
    "Rotate in",
    true,
    `0%{${O(origin)}${T(`rotate3d(0,0,1,${deg})`)};opacity:0}100%{${O(origin)}${T("translate3d(0,0,0)")};opacity:1}`
  );
}
for (const [side, [origin, deg]] of Object.entries(rotateOut)) {
  add(
    `rotateOut${side}`,
    "Rotate out",
    false,
    `0%{${O(origin)}opacity:1}100%{${O(origin)}${T(`rotate3d(0,0,1,${deg})`)};opacity:0}`
  );
}

add(
  "hinge",
  "Special",
  false,
  `0%{${O("top left")}}20%,60%{${O("top left")}${T("rotate3d(0,0,1,80deg)")}}40%,80%{${O("top left")}${T("rotate3d(0,0,1,60deg)")};opacity:1}100%{${T("translate3d(0,700px,0)")};opacity:0}`
);
add(
  "rollIn",
  "Special",
  true,
  `0%{opacity:0;${T("translate3d(-100%,0,0) rotate3d(0,0,1,-120deg)")}}100%{opacity:1;${T("translate3d(0,0,0)")}}`,
  "Roll in"
);
add(
  "rollOut",
  "Special",
  false,
  `0%{opacity:1}100%{opacity:0;${T("translate3d(100%,0,0) rotate3d(0,0,1,120deg)")}}`,
  "Roll out"
);

// Zoom.
family("zoomIn", "Zoom in", true, `0%{opacity:0;${T("scale3d(.3,.3,.3)")}}50%{opacity:1}`, (d) => {
  const [x, y] = IN[d];
  const far = T(`scale3d(.1,.1,.1) translate3d(${x * 1000}px,${y * 1000}px,0)`);
  const near = T(`scale3d(.475,.475,.475) translate3d(${x * -10}px,${y * -60}px,0)`);
  return `0%{opacity:0;${far}}60%{opacity:1;${near}}100%{${T("scale3d(1,1,1) translate3d(0,0,0)")}}`;
});
family(
  "zoomOut",
  "Zoom out",
  false,
  `0%{opacity:1}50%{opacity:0;${T("scale3d(.3,.3,.3)")}}100%{opacity:0}`,
  (d) => {
    const [x, y] = OUT[d];
    const near = T(`scale3d(.475,.475,.475) translate3d(${x * -42}px,${y * -60}px,0)`);
    const far = T(`scale3d(.1,.1,.1) translate3d(${x * 2000}px,${y * 2000}px,0)`);
    return `40%{opacity:1;${near}}100%{opacity:0;${far}}`;
  }
);

// Slide.
family(
  "slideIn",
  "Slide in",
  true,
  `0%{${T("translate3d(-100%,0,0)")}}100%{${T("translate3d(0,0,0)")}}`,
  (d) => `0%{${T(shift(IN[d], 100, "%"))}}100%{${T("translate3d(0,0,0)")}}`
);
family(
  "slideOut",
  "Slide out",
  false,
  `0%{${T("translate3d(0,0,0)")}}100%{${T("translate3d(-100%,0,0)")}}`,
  (d) => `0%{${T("translate3d(0,0,0)")}}100%{${T(shift(OUT[d], 100, "%"))}}`
);

export const CSS_ANIMATIONS: readonly CssAnimationDef[] = defs;

const byId = new Map(defs.map((d) => [d.id, d]));
export const cssAnimationById = (id: string): CssAnimationDef | undefined => byId.get(id);

/** The keyframes name used in CSS for an animation id. */
export const cssAnimationName = (id: string): string => `nxt-anim-${id}`;

/** `@keyframes` rules for the given animation ids (unknown ids are skipped). */
export function cssAnimationKeyframes(ids: Iterable<string>): string {
  const seen = new Set<string>();
  let css = "";
  for (const id of ids) {
    const def = byId.get(id);
    if (!def || seen.has(id)) continue;
    seen.add(id);
    css += `@keyframes ${cssAnimationName(id)}{${def.frames}}`;
  }
  return css;
}
