import { PLAYER_ACTIONS } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { wanted } from "../media/player";
import { mediaHandlers } from "./media-handlers";

describe("player actions", () => {
  it("has a handler for every action that is not greyed, and none for the others", () => {
    const handlers = mediaHandlers();
    for (const action of PLAYER_ACTIONS)
      expect(Object.keys(handlers).includes(action.type), action.type).toBe(!action.disabled);
  });

  it("reads on, off and toggle against the current state", () => {
    expect(wanted("toggle", false, ["on"], ["off"])).toBe(true);
    expect(wanted("toggle", true, ["on"], ["off"])).toBe(false);
    expect(wanted("on", true, ["on"], ["off"])).toBe(true);
    expect(wanted("off", true, ["on"], ["off"])).toBe(false);
    expect(wanted("mute", false, ["mute"], ["unmute"])).toBe(true);
    expect(wanted("unmute", true, ["mute"], ["unmute"])).toBe(false);
  });
});
