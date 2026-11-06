import { newAnimation, newTimeline } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { hostMessageSchema } from "../canvas/protocol";
import { exportAnimations, parseAnimationImport } from "./animation-io";

const sample = () => {
  const timeline = newTimeline("tl-1", "Hero", "fo-1");
  timeline.animations.push(newAnimation("an-1", "Fade"));
  return { folders: [{ id: "fo-1", name: "Home" }], timelines: [timeline] };
};

describe("animation import and export", () => {
  it("round-trips with fresh ids and the folder link kept", () => {
    const result = parseAnimationImport(exportAnimations(sample()));
    if (!result.ok) throw new Error(result.error);
    const [folder] = result.settings.folders;
    const [timeline] = result.settings.timelines;
    expect(folder?.id).not.toBe("fo-1");
    expect(timeline?.id).not.toBe("tl-1");
    expect(timeline?.folderId).toBe(folder?.id);
    expect(timeline?.animations[0]?.id).not.toBe("an-1");
    expect(timeline?.animations[0]?.name).toBe("Fade");
  });

  it("rejects text that is not JSON, other files and bad data", () => {
    expect(parseAnimationImport("{nope").ok).toBe(false);
    expect(parseAnimationImport(JSON.stringify({ folders: [] })).ok).toBe(false);
    const bad = JSON.parse(exportAnimations(sample())) as { timelines: { trigger: string }[] };
    bad.timelines[0]!.trigger = "teleport";
    expect(parseAnimationImport(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("animation preview messages", () => {
  it("accepts load, transport and seek commands and rejects a negative seek", () => {
    const timeline = sample().timelines[0];
    expect(hostMessageSchema.safeParse({ type: "anim-load", timeline }).success).toBe(true);
    for (const command of ["play", "pause", "stop", "clear"]) {
      expect(hostMessageSchema.safeParse({ type: "anim-control", command }).success).toBe(true);
    }
    expect(hostMessageSchema.safeParse({ type: "anim-seek", time: 1.5 }).success).toBe(true);
    expect(hostMessageSchema.safeParse({ type: "anim-seek", time: -1 }).success).toBe(false);
  });
});
