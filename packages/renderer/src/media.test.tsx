import {
  DEFAULT_BREAKPOINTS,
  buildDynamicContext,
  defaultPageSettings,
  emptyPageTree,
  type ElementNode
} from "@nextomic/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageRenderer, elementCss, getElementDefinition } from "./index";

const draw = (
  type: "video" | "audio",
  props: Record<string, string | boolean> = {},
  mode: "editor" | "live" = "live"
) => {
  const defaults = getElementDefinition(type)!.defaults();
  const node: ElementNode = {
    id: "m1",
    type,
    name: type,
    classIds: [],
    props: { ...defaults.props, ...props },
    styles: { breakpoints: {} },
    actions: {},
    children: []
  };
  const tree = { ...emptyPageTree(), children: [node] };
  // The page style block names every part, so only the markup is checked.
  const markup = renderToStaticMarkup(
    <PageRenderer
      tree={tree}
      breakpoints={DEFAULT_BREAKPOINTS}
      dynamic={buildDynamicContext({
        page: { name: "P", route: "/", settings: defaultPageSettings() },
        mode
      })}
    />
  );
  return markup.replace(/<style>[\s\S]*?<\/style>/g, "");
};

describe("video and audio players", () => {
  it("draws a video with a bar of designable parts and the native bar as fallback", () => {
    const html = draw("video", { src: "/media/p/clip.mp4" });
    expect(html).toContain("<video");
    expect(html).toContain('src="/media/p/clip.mp4"');
    expect(html).toContain("controls");
    for (const part of [
      "data-nxt-bar",
      "data-nxt-seek",
      "data-nxt-time",
      'data-nxt-btn="play"',
      'data-nxt-btn="mute"',
      "data-nxt-vol",
      'data-nxt-btn="fullscreen"',
      'data-nxt-btn="big"'
    ])
      expect(html).toContain(part);
    expect(html).toContain('data-kind="video"');
  });

  it("leaves out every control that is switched off, and keeps the rest", () => {
    const html = draw("video", {
      showSeek: false,
      showTime: false,
      showMute: false,
      showVolume: false,
      showFull: false,
      showBig: false,
      showCaptions: false
    });
    for (const gone of [
      "data-nxt-seek",
      "data-nxt-time",
      'btn="mute"',
      "data-nxt-vol",
      'btn="fullscreen"',
      'btn="big"'
    ])
      expect(html).not.toContain(gone);
    expect(html).toContain('data-nxt-btn="play"');
  });

  it("shows the optional controls when they are switched on", () => {
    const html = draw("video", {
      showSpeed: true,
      showLoop: true,
      showPip: true,
      showDownload: true,
      showBack: true,
      showForward: true,
      showTitle: true,
      title: "Intro",
      skip: "15",
      src: "/media/p/clip.mp4"
    });
    for (const part of [
      'btn="speed"',
      'btn="loop"',
      'btn="pip"',
      'btn="download"',
      'btn="back"',
      'btn="forward"'
    ])
      expect(html).toContain(part);
    expect(html).toContain("Back 15 seconds");
    expect(html).toContain("Intro");
    expect(html).toContain('href="/media/p/clip.mp4"');
  });

  it("offers captions only when a captions file is set", () => {
    expect(draw("video", {})).not.toContain('btn="captions"');
    const html = draw("video", {
      captions: "/media/p/en.vtt",
      captionsLang: "de",
      captionsLabel: "Deutsch"
    });
    expect(html).toContain('btn="captions"');
    expect(html).toContain('srcLang="de"');
    expect(html).toContain('label="Deutsch"');
  });

  it("starts autoplay muted and inline, but never in the editor", () => {
    const live = draw("video", { autoplay: true });
    expect(live).toContain("autoPlay");
    expect(live).toContain("muted");
    expect(live).toContain("playsInline");
    expect(draw("video", { autoplay: true }, "editor")).not.toContain("autoPlay");
  });

  it("refuses an unsafe source", () => {
    const html = draw("video", { src: "javascript:alert(1)", poster: "javascript:alert(2)" });
    expect(html).not.toContain("javascript:");
  });

  it("renders the browser bar, or no bar at all, on request", () => {
    const native = draw("video", { controls: "native" });
    expect(native).toContain("controls");
    expect(native).not.toContain("data-nxt-bar");
    const none = draw("video", { controls: "none" });
    expect(none).not.toContain("data-nxt-bar");
    expect(none).not.toMatch(/<video[^>]* controls/);
  });

  it("shows the bar in the editor without the native controls", () => {
    const html = draw("video", {}, "editor");
    expect(html).toContain("data-nxt-bar");
    expect(html).toContain("data-nxt-ready");
    expect(html).not.toContain("<video controls");
    expect(html).not.toMatch(/<video[^>]* controls/);
  });

  it("carries the settings the runtime reads", () => {
    const html = draw("video", {
      speed: "1.5",
      speeds: "2, 1, 0.5",
      startAt: "12",
      keys: true,
      clickToPlay: true,
      autoHide: true
    });
    expect(html).toContain('data-speeds="0.5,1,2"');
    expect(html).toContain('data-speed="1.5"');
    expect(html).toContain('data-start="12"');
    expect(html).toContain("data-keys");
    expect(html).toContain("data-click");
    expect(html).toContain("data-autohide");
  });

  it("draws an audio player without the video-only controls", () => {
    const html = draw("audio", { src: "/media/p/song.mp3", showTitle: true, title: "Song" });
    expect(html).toContain("<audio");
    expect(html).toContain('data-kind="audio"');
    for (const gone of ['btn="big"', 'btn="fullscreen"', 'btn="pip"', 'btn="captions"'])
      expect(html).not.toContain(gone);
    expect(html).toContain("Song");
  });

  it("styles a button part and its on state through the player root", () => {
    const node: ElementNode = {
      id: "m1",
      type: "video",
      name: "v",
      classIds: [],
      props: {},
      actions: {},
      children: [],
      styles: {
        breakpoints: {
          base: {
            default: {
              "--nxt-ip-mplay-color": "red",
              "--nxt-ip-mplay-background-color-checked": "blue",
              "--nxt-ip-mseek-display": "none"
            }
          }
        }
      }
    };
    const css = elementCss(node, DEFAULT_BREAKPOINTS);
    expect(css).toContain('[data-nxt-media] [data-nxt-btn="play"]');
    expect(css).toContain("color:red");
    expect(css).toContain('[aria-pressed="true"]');
    expect(css).toContain("background-color:blue");
    expect(css).toContain("[data-nxt-seek]");
  });
});
