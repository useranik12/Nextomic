import { describe, expect, it } from "vitest";
import { getAction, PLAYER_ACTIONS, playerCommandOf, triggerProblem } from "./actions";
import { FORM_DESIGN_PARTS, designPartsFor, parseFormDesignKey } from "./choice-design";
import { inputPartSelectors } from "./input-design";
import { MEDIA_PARTS, mediaPartsFor } from "./media-design";
import { clockText, parseSeconds, parseSpeeds, speedText } from "./media-player";

describe("player design parts", () => {
  it("never reuses a part id of another form field, and ids carry no dash", () => {
    const ids = FORM_DESIGN_PARTS.map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of MEDIA_PARTS) expect(part.id).not.toContain("-");
  });

  it("gives the video every part and the audio the ones that make sense", () => {
    expect(designPartsFor("video")).toHaveLength(MEDIA_PARTS.length);
    const audio = mediaPartsFor("audio").map((part) => part.id);
    for (const gone of ["msurface", "mbig", "mcc", "mpip", "mfull"])
      expect(audio).not.toContain(gone);
    expect(audio).toContain("mplay");
    expect(designPartsFor("audio").map((part) => part.id)).toEqual(audio);
  });

  it("reads a style key into its part, property and state", () => {
    const parsed = parseFormDesignKey("--nxt-ip-mplay-background-color-checked");
    expect(parsed?.part.id).toBe("mplay");
    expect(parsed?.prop).toBe("background-color");
    expect(parsed?.state).toBe("checked");
    expect(parseFormDesignKey("--nxt-ip-mseek-display")?.state).toBe("default");
    expect(parseFormDesignKey("--nxt-ip-mplay-nonsense")).toBeNull();
  });

  it("starts every selector at the player root, not at a form field", () => {
    const play = MEDIA_PARTS.find((part) => part.id === "mplay")!;
    for (const state of play.states)
      for (const selector of inputPartSelectors(".x", play, state)) {
        expect(selector).toContain("[data-nxt-media]");
        expect(selector).not.toContain("[data-nxt-field]");
      }
    const on = inputPartSelectors(".x", play, "checked").join(" ");
    expect(on).toContain('[aria-pressed="true"]');
    expect(on).toContain('[data-nxt-force="checked"]');
  });

  it("gives every part a position order or a place in the bar", () => {
    const withOrder = MEDIA_PARTS.filter((part) =>
      part.groups.some((group) => group.props.some((item) => item.prop === "order"))
    ).map((part) => part.id);
    for (const id of ["mplay", "mmute", "mspeed", "mtime", "mseek", "mvol", "mtitle", "mdl"])
      expect(withOrder).toContain(id);
  });
});

describe("player facts", () => {
  it("reads speeds, seconds and clocks", () => {
    expect(parseSpeeds("2, 1x, 0.5, nope, 99")).toEqual([0.5, 1, 2]);
    expect(parseSpeeds("")).toEqual([1]);
    expect(parseSeconds("", 10)).toBe(10);
    expect(parseSeconds("-3", 10)).toBe(10);
    expect(parseSeconds("30", 10)).toBe(30);
    expect(clockText(7)).toBe("0:07");
    expect(clockText(725)).toBe("12:05");
    expect(clockText(3723)).toBe("1:02:03");
    expect(clockText(NaN)).toBe("0:00");
    expect(speedText(1)).toBe("1x");
    expect(speedText(0.75)).toBe("0.75x");
  });
});

describe("player actions and triggers", () => {
  it("runs the player actions on the right kind of element", () => {
    for (const action of PLAYER_ACTIONS.filter((a) => !a.disabled)) {
      const element = action.fields.find((f) => f.key === "element");
      expect(element?.elementTypes).toEqual([action.type.split(".")[0]]);
      expect(element?.selfWhenEmpty).toBe(true);
    }
    expect(getAction("video.fullscreen")).toBeDefined();
    expect(getAction("audio.fullscreen")).toBeUndefined();
    expect(playerCommandOf("audio.seek")).toEqual({ kind: "audio", command: "seek" });
    expect(playerCommandOf("video.step")).toBeNull();
  });

  it("keeps the playlist actions listed but greyed", () => {
    for (const name of ["step", "playlistAdd", "playlistRemove", "shuffle"])
      expect(getAction(`video.${name}`)?.disabled).toMatch(/Playlists/);
  });

  it("allows the media triggers on a video and an audio element", () => {
    for (const trigger of [
      "loaded",
      "played",
      "paused",
      "ended",
      "stopped",
      "playedLength",
      "seeked",
      "loadError"
    ]) {
      expect(triggerProblem(`video.${trigger}`, "element", "video")).toBeNull();
      expect(triggerProblem(`audio.${trigger}`, "element", "audio")).toBeNull();
    }
  });
});
