import type { ActionDef } from "./catalog";
import type { FieldOption, ParamField } from "./fields";

// Actions of the Video and Audio players (docs/elements.md "Video and Audio"). They run in the
// browser on the player of this element or of a chosen one; the runtime is
// `packages/runtime/src/media/`. Playlist actions stay listed but greyed.

const opts = (pairs: readonly [string, string][]): FieldOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

const PLAYLIST_REASON = "Playlists are not built yet.";

type Kind = "video" | "audio";

/** The player to act on: empty means the element the flow belongs to. */
const player = (kind: Kind): ParamField => ({
  key: "element",
  label: kind === "video" ? "Video" : "Audio",
  kind: "element",
  elementTypes: [kind],
  selfWhenEmpty: true,
  help: "Leave empty for this element."
});

const mode = (
  label: string,
  choices: readonly [string, string][],
  fallback: string
): ParamField => ({
  key: "mode",
  label,
  kind: "select",
  default: fallback,
  options: opts(choices)
});

const TOGGLE: readonly [string, string][] = [
  ["toggle", "Toggle"],
  ["on", "On"],
  ["off", "Off"]
];

function actionsFor(kind: Kind): ActionDef[] {
  const noun = kind === "video" ? "Video" : "Audio";
  const subcategory = `${noun} Player`;
  const def = (
    name: string,
    label: string,
    description: string,
    fields: ParamField[] = [],
    summary?: readonly string[]
  ): ActionDef => ({
    type: `${kind}.${name}`,
    label,
    category: "media",
    subcategory,
    runs: "browser",
    description,
    fields: [player(kind), ...fields],
    ...(summary ? { summary } : {})
  });
  const list: ActionDef[] = [
    def(
      "play",
      `Play ${noun}`,
      "Starts playing. A browser may refuse until the visitor has clicked."
    ),
    def("pause", `Pause ${noun}`, "Pauses at the current time."),
    def("toggle", `Play / Pause ${noun}`, "Plays when paused and pauses when playing."),
    def("stop", `Stop ${noun}`, "Pauses and goes back to the start (or the Start at time)."),
    def(
      "seek",
      `Seek ${noun}`,
      "Jumps to a time.",
      [
        mode(
          "Jump to",
          [
            ["seconds", "A time in seconds"],
            ["percent", "A percent of the length"]
          ],
          "seconds"
        ),
        { key: "value", label: "Value", kind: "number", min: 0, required: true }
      ],
      ["mode", "value"]
    ),
    def(
      "skip",
      `Skip ${noun}`,
      "Moves forward or back by some seconds (a negative number goes back).",
      [{ key: "seconds", label: "Seconds", kind: "number", default: "10", required: true }],
      ["seconds"]
    ),
    def(
      "volume",
      `Set ${noun} Volume`,
      "Sets the volume from 0 to 100.",
      [
        {
          key: "level",
          label: "Volume (0 to 100)",
          kind: "number",
          min: 0,
          max: 100,
          required: true
        }
      ],
      ["level"]
    ),
    def(
      "mute",
      `Mute ${noun}`,
      "Mutes, unmutes or toggles the sound.",
      [
        mode(
          "Sound",
          [
            ["toggle", "Toggle"],
            ["mute", "Mute"],
            ["unmute", "Unmute"]
          ],
          "toggle"
        )
      ],
      ["mode"]
    ),
    def(
      "speed",
      `Set ${noun} Speed`,
      "Sets the playback speed (1 is normal).",
      [
        {
          key: "speed",
          label: "Speed",
          kind: "number",
          default: "1",
          min: 0.0625,
          max: 16,
          required: true
        }
      ],
      ["speed"]
    ),
    def(
      "loop",
      "Set Loop Option",
      "Makes it repeat, stop repeating, or toggles.",
      [mode("Loop", TOGGLE, "toggle")],
      ["mode"]
    ),
    def(
      "controls",
      `Show / Hide ${noun} Controls`,
      "Shows or hides the control bar (the player keeps playing).",
      [
        mode(
          "Control bar",
          [
            ["toggle", "Toggle"],
            ["show", "Show"],
            ["hide", "Hide"]
          ],
          "toggle"
        )
      ],
      ["mode"]
    ),
    def(
      "source",
      `Set ${noun} Source`,
      "Loads another file into the player.",
      [
        {
          key: "src",
          label: "Source URL",
          kind: "text",
          required: true,
          placeholder: "/media/..."
        },
        ...(kind === "video"
          ? [
              {
                key: "poster",
                label: "Poster URL",
                kind: "text" as const,
                placeholder: "/media/..."
              }
            ]
          : []),
        { key: "play", label: "Play right away", kind: "boolean", default: "false" }
      ],
      ["src"]
    )
  ];
  if (kind === "video") {
    list.push(
      def(
        "fullscreen",
        "Full Screen",
        "Enters or leaves full screen (the browser may ask for a click first).",
        [mode("Full screen", TOGGLE, "toggle")],
        ["mode"]
      ),
      def(
        "pip",
        "Picture in Picture",
        "Opens or closes the small floating window.",
        [mode("Picture in Picture", TOGGLE, "toggle")],
        ["mode"]
      ),
      def(
        "captions",
        "Show / Hide Captions",
        "Shows or hides the captions track.",
        [
          mode(
            "Captions",
            [
              ["toggle", "Toggle"],
              ["show", "Show"],
              ["hide", "Hide"]
            ],
            "toggle"
          )
        ],
        ["mode"]
      )
    );
  }
  for (const [name, label] of [
    ["step", "Play Previous/Next In Playlist"],
    ["playlistAdd", "Add To Playlist"],
    ["playlistRemove", "Remove From Playlist"],
    ["shuffle", "Set Shuffle Mode"]
  ] as const)
    list.push({
      type: `${kind}.${name}`,
      label,
      category: "media",
      subcategory,
      runs: "browser",
      description: label,
      fields: [],
      disabled: PLAYLIST_REASON
    });
  return list;
}

export const PLAYER_ACTIONS: ActionDef[] = [...actionsFor("video"), ...actionsFor("audio")];

/** The command a player action type stands for, or null for any other action. */
export function playerCommandOf(type: string): { kind: Kind; command: string } | null {
  const [kind, command] = type.split(".");
  if ((kind !== "video" && kind !== "audio") || !command) return null;
  return PLAYER_ACTIONS.some((a) => a.type === type && !a.disabled) ? { kind, command } : null;
}
