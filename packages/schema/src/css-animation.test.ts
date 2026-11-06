import { describe, expect, it } from "vitest";
import {
  CSS_ANIMATIONS,
  collectElementAnimations,
  cssAnimationById,
  cssAnimationKeyframes,
  elementAnimationCss,
  elementAnimationSchema,
  elementNodeSchema
} from "./index";

describe("css animation library", () => {
  it("has unique ids and valid-looking keyframes for every animation", () => {
    const ids = CSS_ANIMATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of CSS_ANIMATIONS) {
      expect(a.frames).toMatch(/%\{/);
      expect(a.frames).not.toContain("undefined");
      expect(a.frames).not.toContain("NaN");
    }
  });

  it("includes the requested names and the four sides of each family", () => {
    for (const id of [
      "bounce",
      "flash",
      "rubber-band",
      "shake",
      "shake-x",
      "shake-y",
      "swing",
      "tada",
      "wobble",
      "jello",
      "heartbeat",
      "fade-in",
      "fade-in-down",
      "fade-out-left",
      "bounce-in-up",
      "bounce-out-right",
      "flip",
      "flip-x",
      "flip-y",
      "rotate-in",
      "rotate-in-down-left",
      "rotate-out-up-right",
      "hinge",
      "roll-in",
      "roll-out",
      "zoom-in",
      "zoom-in-left",
      "zoom-out-down",
      "slide-in",
      "slide-in-right",
      "slide-out-up"
    ]) {
      expect(cssAnimationById(id), id).toBeDefined();
    }
  });

  it("moves in from the named side and out toward it", () => {
    expect(cssAnimationById("fade-in-left")?.frames).toContain("translate3d(-100%,0,0)");
    expect(cssAnimationById("fade-in-down")?.frames).toContain("translate3d(0,-100%,0)");
    expect(cssAnimationById("fade-out-down")?.frames).toContain("translate3d(0,100%,0)");
    expect(cssAnimationById("slide-out-left")?.frames).toContain("translate3d(-100%,0,0)");
  });

  it("only writes keyframes for the animations asked for", () => {
    const css = cssAnimationKeyframes(["flash", "flash", "nope"]);
    expect(css).toBe("@keyframes nxt-anim-flash{0%,50%,100%{opacity:1}25%,75%{opacity:0}}");
  });
});

describe("element animation data", () => {
  it("applies defaults and rejects bad selectors", () => {
    const a = elementAnimationSchema.parse({});
    expect(a).toMatchObject({
      trigger: "load",
      delay: 0,
      duration: 1,
      once: false,
      target: "self"
    });
    expect(elementAnimationSchema.safeParse({ triggerSelector: "a{b}" }).success).toBe(false);
    expect(elementAnimationSchema.safeParse({ duration: 0 }).success).toBe(false);
  });

  it("collects animations from a tree and builds their keyframes", () => {
    const tree = elementNodeSchema.parse({
      id: "root",
      type: "body",
      children: [
        { id: "a", type: "heading", animation: { animation: "fade-in", trigger: "scroll" } },
        { id: "b", type: "heading", animation: { animation: "" } },
        { id: "c", type: "heading" }
      ]
    });
    expect(collectElementAnimations(tree).map((s) => s.nodeId)).toEqual(["a"]);
    expect(elementAnimationCss(tree)).toContain("@keyframes nxt-anim-fade-in{");
  });
});
