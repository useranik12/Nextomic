import { describe, expect, it } from "vitest";
import {
  newAnimation,
  newTimeline,
  parseAnimationVars,
  planAnimation,
  timelineToGsapCode,
  timelinesForPage,
  timelineSchema
} from "./animations";

describe("animations", () => {
  it("plans a tween: numeric text becomes numbers, timing and stagger are added", () => {
    const a = {
      ...newAnimation("a", "Fade"),
      properties: { opacity: "0", y: 40, backgroundColor: "#fff" },
      duration: 1.5,
      delay: 0.2,
      yoyo: true,
      repeat: 2,
      stagger: { enabled: true, amount: 0.1, from: "start" as const, ease: "none" }
    };
    const plan = planAnimation(a);
    expect(plan.method).toBe("from");
    expect(plan.to).toEqual({
      opacity: 0,
      y: 40,
      backgroundColor: "#fff",
      duration: 1.5,
      delay: 0.2,
      ease: "power2.out",
      repeat: 2,
      yoyo: true,
      stagger: 0.1
    });
    expect(plan.position).toBeUndefined();
  });

  it("maps position modes and keeps fromTo values; set has no timing", () => {
    const fromTo = {
      ...newAnimation("b", "Move"),
      method: "fromTo" as const,
      fromProperties: { x: -50 },
      properties: { x: 0 },
      position: { mode: "custom" as const, value: "<+=0.3" }
    };
    const plan = planAnimation(fromTo);
    expect(plan.from).toEqual({ x: -50 });
    expect(plan.position).toBe("<+=0.3");
    expect(planAnimation({ ...fromTo, position: { mode: "custom", value: "3" } }).position).toBe(3);
    expect(planAnimation({ ...fromTo, position: { mode: "start", value: "" } }).position).toBe("<");
    expect(planAnimation({ ...fromTo, method: "set" }).to).toEqual({ x: 0 });
  });

  it("merges valid advanced vars and rejects bad JSON", () => {
    expect(parseAnimationVars('{"rotation":90}')).toEqual({ ok: true, vars: { rotation: 90 } });
    expect(parseAnimationVars("").ok).toBe(true);
    expect(parseAnimationVars("[1]").ok).toBe(false);
    expect(parseAnimationVars("{x:1}").ok).toBe(false);
    const a = { ...newAnimation("c", "C"), vars: '{"rotation":90}' };
    expect(planAnimation(a).to.rotation).toBe(90);
  });

  it("prints GSAP code and filters timelines per page", () => {
    const t = {
      ...newTimeline("t", "Intro"),
      triggerSelector: ".hero",
      animations: [newAnimation("a", "Fade")]
    };
    const code = timelineToGsapCode(t);
    expect(code).toContain("gsap.timeline(");
    expect(code).toContain('tl.from("this"');
    expect(timelinesForPage({ timelines: [t] }, "p1")).toHaveLength(1);
    expect(timelinesForPage({ timelines: [{ ...t, pageIds: ["p2"] }] }, "p1")).toHaveLength(0);
    expect(timelinesForPage({ timelines: [{ ...t, enabled: false }] }, "p1")).toHaveLength(0);
  });

  it("refuses unsafe selectors, eases and toggle actions", () => {
    const base = newTimeline("t", "T");
    expect(timelineSchema.safeParse({ ...base, triggerSelector: "a{b}" }).success).toBe(false);
    expect(timelineSchema.safeParse({ ...base, matchMedia: "(min-width:1px){x}" }).success).toBe(
      false
    );
    expect(
      timelineSchema.safeParse({
        ...base,
        scrollTrigger: { ...base.scrollTrigger, toggleActions: "play" }
      }).success
    ).toBe(false);
  });
});

describe("layoutAnimations", () => {
  it("places animations like GSAP's position parameter", async () => {
    const { layoutAnimations, timelineLength } = await import("./animations");
    const make = (id: string, duration: number, mode: "end" | "start" | "custom", value = "") => ({
      ...newAnimation(id, id),
      duration,
      position: { mode, value }
    });
    const slots = layoutAnimations([
      make("a", 1, "end"),
      make("b", 1, "end"),
      make("c", 1, "start"),
      make("d", 1, "custom", "-=0.5"),
      make("e", 1, "custom", "5"),
      make("f", 1, "custom", ">+=0.25")
    ]);
    expect(slots.map((s) => [s.id, s.start])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 1],
      ["d", 1.5],
      ["e", 5],
      ["f", 6.25]
    ]);
    expect(timelineLength([make("a", 2, "end"), make("b", 1, "custom", "5")])).toBe(6);
  });
});
