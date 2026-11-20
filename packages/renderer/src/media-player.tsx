import {
  DEFAULT_SKIP_SECONDS,
  DEFAULT_SPEEDS,
  PLAYER_BAR_POSITIONS,
  PLAYER_CONTROL_MODES,
  PLAYER_PRELOADS,
  PLAYER_SWITCHES,
  clockText,
  parseSeconds,
  parseSpeeds,
  speedText,
  type PlayerKind
} from "@nextomic/schema";
import { createElement, type CSSProperties, type ReactNode } from "react";
import { z } from "zod";
import { looseValue, on } from "./field-parts";
import { registerElement, type ControlDef, type RenderContext } from "./registry";
import { safeUrl } from "./values";

// Video and Audio (docs/elements.md "Video and Audio"). One player for both: a real <video> or
// <audio> with a control bar of plain, designable elements laid over it. The runtime
// (`packages/runtime/src/media/`) drives the bar; with no runtime the native controls stay on, so
// the file still plays.

/** Material Design icon paths (Apache 2.0), drawn in the text color. */
const PATHS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zm8 0h4v14h-4z",
  back: "M11 18V6l-8.5 6zm.5-6 8.5 6V6z",
  forward: "M4 18l8.5-6L4 6zm9-12v12l8.5-6z",
  volume:
    "M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
  muted:
    "M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z",
  loop: "M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z",
  captions:
    "M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1z",
  pip: "M19 11h-8v6h8zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18z",
  full: "M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z",
  exitFull: "M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z",
  download: "M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z"
} as const;

type Glyph = keyof typeof PATHS;

const glyph = (name: Glyph, when?: "on" | "off"): ReactNode =>
  createElement(
    "svg",
    {
      key: name,
      viewBox: "0 0 24 24",
      width: "1em",
      height: "1em",
      fill: "currentColor",
      "aria-hidden": "true",
      focusable: "false",
      "data-nxt-when": when
    },
    createElement("path", { d: PATHS[name] })
  );

/** A button with an off face and an on face (shown by its pressed state). */
const faces = (off: Glyph, onFace: Glyph): ReactNode[] => [glyph(off, "off"), glyph(onFace, "on")];

const button = (
  kind: string,
  label: string,
  children: ReactNode,
  extra: Record<string, unknown> = {}
): ReactNode =>
  createElement(
    "button",
    {
      key: kind,
      type: "button",
      "data-nxt-btn": kind,
      "aria-label": label,
      ...extra
    },
    children
  );

const toggle = (kind: string, label: string, children: ReactNode, pressed = false): ReactNode =>
  button(kind, label, children, { "aria-pressed": pressed ? "true" : "false" });

const slider = (
  kind: "seek" | "vol",
  label: string,
  fraction: number,
  input: Record<string, unknown>,
  withBuffer: boolean
): ReactNode =>
  createElement(
    "div",
    {
      key: kind,
      [`data-nxt-${kind}`]: "",
      style: { "--nxt-p": String(fraction), "--nxt-b": "0" } as CSSProperties
    },
    createElement("span", { "data-nxt-track": "", "aria-hidden": "true" }),
    withBuffer ? createElement("span", { "data-nxt-buffer": "", "aria-hidden": "true" }) : null,
    createElement("span", { "data-nxt-fill": "", "aria-hidden": "true" }),
    createElement("span", { "data-nxt-thumb": "", "aria-hidden": "true" }),
    kind === "seek" ? createElement("span", { "data-nxt-tip": "", "aria-hidden": "true" }) : null,
    createElement("input", {
      type: "range",
      "aria-label": label,
      "data-nxt-slider": kind,
      ...input
    })
  );

function bar(ctx: RenderContext, kind: PlayerKind, hasCaptions: boolean): ReactNode {
  const flag = (key: string) => on(ctx, key);
  const video = kind === "video";
  const skip = parseSeconds(ctx.text("skip"), DEFAULT_SKIP_SECONDS);
  const startSpeed = Number(ctx.text("speed")) || 1;
  const src = safeUrl(ctx.text("src"));
  const items: (ReactNode | false)[] = [
    flag("showTitle") &&
      createElement("span", { key: "title", "data-nxt-title": "" }, ctx.text("title")),
    flag("showSeek") &&
      slider("seek", "Seek", 0, { min: 0, max: 1000, step: 1, defaultValue: 0 }, true),
    flag("showBack") &&
      button("back", `Back ${skip} seconds`, glyph("back"), { "data-skip": String(skip) }),
    flag("showPlay") && toggle("play", "Play", faces("play", "pause")),
    flag("showForward") &&
      button("forward", `Forward ${skip} seconds`, glyph("forward"), { "data-skip": String(skip) }),
    flag("showMute") && toggle("mute", "Mute", faces("volume", "muted")),
    flag("showVolume") &&
      slider("vol", "Volume", 1, { min: 0, max: 100, step: 1, defaultValue: 100 }, false),
    flag("showTime") &&
      createElement(
        "span",
        { key: "time", "data-nxt-time": "" },
        createElement("span", { "data-nxt-current": "" }, clockText(0)),
        createElement("span", { "data-nxt-sep": "", "aria-hidden": "true" }, " / "),
        createElement("span", { "data-nxt-duration": "" }, clockText(0))
      ),
    createElement("span", { key: "spacer", "data-nxt-spacer": "", "aria-hidden": "true" }),
    flag("showSpeed") &&
      button("speed", "Playback speed", speedText(startSpeed), {
        "data-nxt-speed": String(startSpeed)
      }),
    flag("showLoop") && toggle("loop", "Loop", glyph("loop"), on(ctx, "loop")),
    video &&
      hasCaptions &&
      flag("showCaptions") &&
      toggle("captions", "Captions", glyph("captions")),
    video && flag("showPip") && button("pip", "Picture in picture", glyph("pip")),
    video && flag("showFull") && toggle("fullscreen", "Full screen", faces("full", "exitFull")),
    flag("showDownload") &&
      createElement(
        "a",
        {
          key: "download",
          "data-nxt-btn": "download",
          "aria-label": "Download",
          href: src === "" ? undefined : src,
          download: ""
        },
        glyph("download")
      )
  ];
  return createElement("div", { "data-nxt-bar": "" }, ...items.filter(Boolean));
}

function render(kind: PlayerKind) {
  return (ctx: RenderContext): ReactNode => {
    const { attrs } = ctx;
    const video = kind === "video";
    const mode = PLAYER_CONTROL_MODES.find((m) => m === ctx.text("controls")) ?? "custom";
    const preload = PLAYER_PRELOADS.find((m) => m === ctx.text("preload")) ?? "metadata";
    const position = PLAYER_BAR_POSITIONS.find((m) => m === ctx.text("barPosition")) ?? "overlay";
    const src = safeUrl(ctx.text("src"));
    const poster = video ? safeUrl(ctx.text("poster")) : "";
    const captions = video ? safeUrl(ctx.text("captions")) : "";
    const title = ctx.text("title");
    const speeds = parseSpeeds(ctx.text("speeds") || DEFAULT_SPEEDS);
    // Autoplay is refused by browsers unless the sound is off, and it never runs in the editor.
    const autoplay = on(ctx, "autoplay") && ctx.mode !== "editor";
    const custom = mode === "custom";
    const label = title || (video ? "Video player" : "Audio player");
    const mediaTag = createElement(
      video ? "video" : "audio",
      {
        key: "el",
        "data-nxt-el": "",
        src: src === "" ? undefined : src,
        poster: poster === "" ? undefined : poster,
        preload,
        loop: on(ctx, "loop") || undefined,
        muted: on(ctx, "muted") || autoplay || undefined,
        autoPlay: autoplay || undefined,
        playsInline: video || undefined,
        // The native bar is the fallback: the runtime removes it once it has drawn its own.
        controls: mode === "native" || (custom && ctx.mode !== "editor") || undefined,
        "aria-label": label
      },
      captions === ""
        ? null
        : createElement("track", {
            kind: "captions",
            src: captions,
            srcLang: ctx.text("captionsLang") || "en",
            label: ctx.text("captionsLabel") || "Captions"
          })
    );
    const showBig = video && custom && on(ctx, "showBig");
    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-media": "",
        // The editor canvas runs no script: it shows the bar as it rests.
        "data-nxt-ready": ctx.mode === "editor" ? "" : undefined,
        "data-kind": kind,
        "data-state": "paused",
        "data-bar": video ? position : "below",
        "data-controls": mode,
        "data-autohide": video && position === "overlay" && on(ctx, "autoHide") ? "" : undefined,
        "data-click": video && on(ctx, "clickToPlay") ? "" : undefined,
        "data-keys": on(ctx, "keys") ? "" : undefined,
        "data-skip": String(parseSeconds(ctx.text("skip"), DEFAULT_SKIP_SECONDS)),
        "data-speeds": speeds.join(","),
        "data-speed": String(Number(ctx.text("speed")) || 1),
        "data-start": String(parseSeconds(ctx.text("startAt"), 0)),
        tabIndex: on(ctx, "keys") ? 0 : undefined,
        role: "group",
        "aria-label": label
      },
      mediaTag,
      showBig ? button("big", "Play", glyph("play")) : null,
      custom ? bar(ctx, kind, captions !== "") : null
    );
  };
}

const sw = (key: string, label: string, group: string): ControlDef => ({
  key,
  label,
  kind: "switch",
  group
});

const text = (key: string, label: string, group: string, placeholder?: string): ControlDef => ({
  key,
  label,
  kind: "text",
  group,
  ...(placeholder ? { placeholder } : {})
});

function controlsFor(kind: PlayerKind): ControlDef[] {
  const video = kind === "video";
  return [
    {
      key: "src",
      label: "Source URL",
      kind: "url",
      placeholder: "https://...",
      pick: [kind],
      group: "Source"
    },
    ...(video
      ? [
          {
            key: "poster",
            label: "Poster image",
            kind: "url" as const,
            placeholder: "https://...",
            pick: ["image" as const],
            group: "Source"
          },
          {
            key: "captions",
            label: "Captions file (.vtt)",
            kind: "url" as const,
            placeholder: "https://...",
            pick: ["other" as const],
            group: "Source"
          },
          text("captionsLang", "Captions language", "Source", "en"),
          text("captionsLabel", "Captions label", "Source", "English")
        ]
      : []),
    text("title", "Title", "Source"),
    sw("autoplay", "Autoplay (starts muted)", "Playback"),
    sw("loop", "Loop", "Playback"),
    sw("muted", "Muted", "Playback"),
    {
      key: "preload",
      label: "Preload",
      kind: "select",
      options: [
        { value: "metadata", label: "Length only" },
        { value: "none", label: "Nothing" },
        { value: "auto", label: "The whole file" }
      ],
      group: "Playback"
    },
    text("startAt", "Start at (seconds)", "Playback", "0"),
    text("speed", "Speed", "Playback", "1"),
    text("speeds", "Speeds to cycle through", "Playback", DEFAULT_SPEEDS),
    text("skip", "Skip (seconds)", "Playback", String(DEFAULT_SKIP_SECONDS)),
    {
      key: "controls",
      label: "Controls",
      kind: "select",
      options: [
        { value: "custom", label: "Custom bar" },
        { value: "native", label: "Browser bar" },
        { value: "none", label: "None" }
      ],
      group: "Controls"
    },
    ...PLAYER_SWITCHES.filter((s) => video || !s.videoOnly).map((s) =>
      sw(s.prop, s.label, "Controls")
    ),
    ...(video
      ? [
          {
            key: "barPosition",
            label: "Bar position",
            kind: "select" as const,
            options: [
              { value: "overlay", label: "Over the video" },
              { value: "below", label: "Below the video" },
              { value: "above", label: "Above the video" }
            ],
            group: "Behavior"
          },
          sw("autoHide", "Hide the bar while playing", "Behavior"),
          sw("clickToPlay", "Click the picture to play", "Behavior")
        ]
      : []),
    sw("keys", "Keyboard shortcuts", "Behavior")
  ];
}

function register(kind: PlayerKind) {
  const video = kind === "video";
  const switches = PLAYER_SWITCHES.filter((s) => video || !s.videoOnly);
  const props: Record<string, string | boolean> = {
    src: "",
    title: "",
    autoplay: false,
    loop: false,
    muted: false,
    preload: "metadata",
    startAt: "",
    speed: "1",
    speeds: DEFAULT_SPEEDS,
    skip: String(DEFAULT_SKIP_SECONDS),
    controls: "custom",
    keys: true,
    ...(video
      ? {
          poster: "",
          captions: "",
          captionsLang: "en",
          captionsLabel: "English",
          barPosition: "overlay",
          autoHide: true,
          clickToPlay: true
        }
      : {})
  };
  for (const s of switches) props[s.prop] = s.on;
  const shape: Record<string, z.ZodType> = {};
  for (const key of Object.keys(props)) shape[key] = looseValue;
  shape.preload = z.enum(PLAYER_PRELOADS);
  shape.controls = z.enum(PLAYER_CONTROL_MODES);
  if (video) shape.barPosition = z.enum(PLAYER_BAR_POSITIONS);
  const fixed = new Set(["preload", "controls", "barPosition"]);
  registerElement({
    type: kind,
    label: video ? "Video" : "Audio",
    category: "basic",
    canHaveChildren: false,
    defaults: () => ({ props: { ...props }, name: video ? "Video" : "Audio" }),
    propsSchema: z.object(shape),
    controls: controlsFor(kind),
    bindable: Object.fromEntries(
      Object.keys(props).map((key) => [
        key,
        fixed.has(key) ? { reason: "A fixed choice, not data." } : (true as const)
      ])
    ),
    render: render(kind)
  });
}

register("video");
register("audio");
