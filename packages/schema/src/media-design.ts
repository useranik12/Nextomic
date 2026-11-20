// Design of the Video and Audio players (docs/elements.md "Video and Audio"). Same method as the
// form fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]`. The
// control bar is one flat row of plain elements over a real <video>/<audio>, so every button, bar
// and text can be shown, hidden, ordered and styled on its own. Part ids carry no dash (the key
// parser splits at the first one) and never reuse an id of another form part.

import { DESIGN_KIT, type InputDesignGroup, type InputPart } from "./input-design";
import { forcedState, repeatedStates } from "./part-states";

const { p, TEXT, BORDER, SIZE, SPACING, ORDER } = DESIGN_KIT;

const ROOT = "[data-nxt-media]";

/** The two elements of the player. */
export type PlayerKind = "video" | "audio";

const PLAYING = '[data-state="playing"]';

/** Parts that are not buttons: Hover is the pointer over the player, On is while it plays. */
const surroundStates = (selector: string) =>
  repeatedStates(
    selector,
    {},
    { hover: ":where(:hover)", focus: ":where(:focus-within)", checked: `:where(${PLAYING})` }
  );

/** Buttons react to their own hover and keyboard focus; On is the pressed state (aria-pressed). */
const buttonStates = (selector: string) =>
  repeatedStates(selector, {
    hover: ":where(:hover)",
    focus: ":where(:focus-visible)",
    checked: ':where([aria-pressed="true"])',
    disabled: ":where(:disabled)"
  });

const POSITION: InputDesignGroup = {
  label: "Position",
  props: [
    ORDER,
    p("display", "Display", {
      options: ["inline-flex", "flex", "block", "none"],
      tip: "Set to none to hide the part. The Controls switches on the Element tab leave it out of the page altogether."
    }),
    p("flex", "Grow and shrink", { placeholder: "0 0 auto" }),
    p("align-self", "Align self", { options: ["center", "flex-start", "flex-end", "stretch"] }),
    p("margin", "Margin", { placeholder: "0" })
  ]
};

const ICON: InputDesignGroup = {
  label: "Icon",
  props: [p("font-size", "Icon size", { placeholder: "20px" }), p("color", "Icon color")]
};

const CHROME: InputDesignGroup = {
  label: "Effects",
  props: [
    p("box-shadow", "Shadow"),
    p("opacity", "Opacity"),
    p("transition", "Transition", { placeholder: "all .15s ease" }),
    p("cursor", "Cursor", { options: ["pointer", "default", "not-allowed"] })
  ]
};

const buttonPart = (id: string, label: string, about: string, kind: string): InputPart => {
  const selector = `[data-nxt-btn="${kind}"]`;
  return {
    id,
    label,
    about,
    selector,
    root: ROOT,
    states: ["default", "hover", "focus", "checked", "disabled"],
    stateTails: buttonStates(selector),
    groups: [
      ICON,
      {
        label: "Size",
        props: [p("width", "Width"), p("height", "Height"), p("min-width", "Min width")]
      },
      BORDER,
      SPACING,
      POSITION,
      CHROME
    ]
  };
};

const barGroups = (): InputDesignGroup[] => [
  { label: "Size", props: [p("height", "Thickness", { placeholder: "6px" })] },
  BORDER,
  {
    label: "Effects",
    props: [p("box-shadow", "Shadow"), p("opacity", "Opacity"), p("transition", "Transition")]
  },
  POSITION
];

const piece = (
  id: string,
  label: string,
  about: string,
  selector: string,
  groups: InputDesignGroup[]
): InputPart => ({
  id,
  label,
  about,
  selector,
  root: ROOT,
  states: ["default", "hover", "focus", "checked"],
  stateTails: surroundStates(selector),
  groups
});

const TEXT_PART: InputDesignGroup[] = [
  TEXT,
  {
    label: "Background",
    props: [p("background-color", "Background"), p("border-radius", "Radius")]
  },
  SPACING,
  POSITION
];

const THUMB_GROUPS: InputDesignGroup[] = [
  {
    label: "Size",
    props: [
      p("width", "Width", { placeholder: "14px" }),
      p("height", "Height", { placeholder: "14px" })
    ]
  },
  BORDER,
  {
    label: "Effects",
    props: [
      p("box-shadow", "Shadow"),
      p("opacity", "Opacity"),
      p("transition", "Transition"),
      p("transform", "Transform", { placeholder: "scale(1.2)" }),
      p("display", "Display", { options: ["block", "none"] })
    ]
  }
];

const rootTail = (test: string, state: string) => [
  { field: `${ROOT}${test}`, tail: "" },
  { field: `${ROOT}${forcedState(state)}`, tail: "" }
];

export const MEDIA_PARTS: readonly InputPart[] = [
  {
    id: "mroot",
    label: "Player",
    about: "The whole player: picture and control bar together. On means while it plays.",
    selector: "",
    root: ROOT,
    states: ["default", "hover", "focus", "checked"],
    stateTails: {
      default: [{ field: "", tail: "" }],
      hover: rootTail(":where(:hover)", "hover"),
      focus: rootTail(":where(:focus-within)", "focus"),
      checked: rootTail(`:where(${PLAYING})`, "checked")
    },
    groups: [
      SIZE(p("aspect-ratio", "Aspect ratio", { placeholder: "16 / 9" })),
      {
        label: "Layout",
        props: [
          p("display", "Display", { options: ["flex", "block", "none"] }),
          p("flex-direction", "Direction", { options: ["column", "column-reverse"] }),
          p("gap", "Gap", { placeholder: "0" })
        ]
      },
      BORDER,
      SPACING,
      {
        label: "Effects",
        props: [
          p("box-shadow", "Shadow"),
          p("opacity", "Opacity"),
          p("overflow", "Overflow", { options: ["hidden", "visible"] })
        ]
      }
    ]
  },
  piece("msurface", "Picture", "The video itself (and its poster).", "[data-nxt-el]", [
    {
      label: "Picture",
      props: [
        p("object-fit", "Fit", { options: ["contain", "cover", "fill", "none"] }),
        p("aspect-ratio", "Aspect ratio", { placeholder: "16 / 9" }),
        p("background-color", "Background"),
        p("border-radius", "Radius"),
        p("filter", "Filter", { placeholder: "brightness(.9)" })
      ]
    },
    SIZE()
  ]),
  buttonPart(
    "mbig",
    "Big play button",
    "The large button over the picture before it plays.",
    "big"
  ),
  piece("mbar", "Control bar", "The row that holds every control.", "[data-nxt-bar]", [
    {
      label: "Layout",
      props: [
        p("display", "Display", { options: ["flex", "grid", "none"] }),
        p("flex-direction", "Direction", { options: ["row", "row-reverse", "column"] }),
        p("flex-wrap", "Wrap", { options: ["wrap", "nowrap"] }),
        p("align-items", "Align items", {
          options: ["center", "flex-start", "flex-end", "stretch"]
        }),
        p("justify-content", "Justify", {
          options: ["flex-start", "center", "flex-end", "space-between", "space-around"]
        }),
        p("gap", "Gap", { placeholder: "8px" })
      ]
    },
    {
      label: "Position",
      props: [
        p("position", "Position", { options: ["absolute", "relative", "static"] }),
        p("top", "Top", { tip: "How far the bar sits from the top edge of the player." }),
        p("right", "Right", { tip: "How far the bar sits from the right edge of the player." }),
        p("bottom", "Bottom", { tip: "How far the bar sits from the bottom edge of the player." }),
        p("left", "Left", { tip: "How far the bar sits from the left edge of the player." })
      ]
    },
    BORDER,
    SPACING,
    {
      label: "Effects",
      props: [
        p("backdrop-filter", "Backdrop blur", { placeholder: "blur(8px)" }),
        p("box-shadow", "Shadow"),
        p("opacity", "Opacity"),
        p("transition", "Transition")
      ]
    }
  ]),
  piece("mtitle", "Title", "The title text shown in the bar.", "[data-nxt-title]", TEXT_PART),
  piece("mseek", "Seek bar", "The row that holds the track and the thumb.", "[data-nxt-seek]", [
    {
      label: "Size",
      props: [
        p("height", "Height", { placeholder: "18px" }),
        p("width", "Width", { placeholder: "100%" }),
        p("min-width", "Min width")
      ]
    },
    POSITION
  ]),
  piece(
    "mtrack",
    "Seek track",
    "The line behind the thumb.",
    "[data-nxt-seek] [data-nxt-track]",
    barGroups()
  ),
  piece(
    "mbuffer",
    "Seek buffered",
    "The part of the file already loaded.",
    "[data-nxt-seek] [data-nxt-buffer]",
    barGroups()
  ),
  piece(
    "mfill",
    "Seek played",
    "The part that has played.",
    "[data-nxt-seek] [data-nxt-fill]",
    barGroups()
  ),
  piece(
    "mthumb",
    "Seek thumb",
    "The handle the visitor drags.",
    "[data-nxt-seek] [data-nxt-thumb]",
    THUMB_GROUPS
  ),
  piece(
    "mtip",
    "Seek time tip",
    "The time shown over the bar while the pointer is on it.",
    "[data-nxt-tip]",
    TEXT_PART
  ),
  piece("mtime", "Time", "Played time and length.", "[data-nxt-time]", TEXT_PART),
  buttonPart("mback", "Skip back button", "Goes back by the Skip seconds.", "back"),
  buttonPart("mplay", "Play button", "Play and pause. On means it plays.", "play"),
  buttonPart("mfwd", "Skip forward button", "Goes forward by the Skip seconds.", "forward"),
  buttonPart("mmute", "Mute button", "On means muted.", "mute"),
  piece("mvol", "Volume slider", "The row that holds the volume track.", "[data-nxt-vol]", [
    {
      label: "Size",
      props: [
        p("width", "Width", { placeholder: "80px" }),
        p("height", "Height", { placeholder: "18px" })
      ]
    },
    POSITION
  ]),
  piece(
    "mvtrack",
    "Volume track",
    "The line behind the volume thumb.",
    "[data-nxt-vol] [data-nxt-track]",
    barGroups()
  ),
  piece(
    "mvfill",
    "Volume level",
    "The part up to the volume.",
    "[data-nxt-vol] [data-nxt-fill]",
    barGroups()
  ),
  piece(
    "mvthumb",
    "Volume thumb",
    "The handle of the volume slider.",
    "[data-nxt-vol] [data-nxt-thumb]",
    THUMB_GROUPS
  ),
  buttonPart("mspeed", "Speed button", "Shows the speed; a click goes to the next one.", "speed"),
  buttonPart("mloop", "Loop button", "On means it repeats.", "loop"),
  buttonPart("mcc", "Captions button", "On means captions are shown.", "captions"),
  buttonPart(
    "mpip",
    "Picture in Picture button",
    "Opens the video in a small floating window.",
    "pip"
  ),
  buttonPart("mfull", "Full screen button", "On means full screen.", "fullscreen"),
  buttonPart("mdl", "Download button", "Saves the file.", "download")
];

/** Parts only the video has (the Audio panel leaves them out). */
const VIDEO_ONLY = new Set(["msurface", "mbig", "mcc", "mpip", "mfull"]);

/** The parts of a player, in panel order. */
export const mediaPartsFor = (kind: PlayerKind): readonly InputPart[] =>
  kind === "video" ? MEDIA_PARTS : MEDIA_PARTS.filter((part) => !VIDEO_ONLY.has(part.id));
