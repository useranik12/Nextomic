"use client";

import type { Marks, MarkLevel } from "@nextomic/schema";

/**
 * The change dots of the Design panel. Yellow: the element has its own value (bright: at this
 * breakpoint and state, faded: only at another). Sky blue: classes applied to the element (bright:
 * the class being edited sets it here, faded: an applied class sets it). Yellow always comes first.
 */
const COLOR = {
  element: { here: "bg-warning", elsewhere: "bg-warning/35" },
  classes: { here: "bg-sky-500", elsewhere: "bg-sky-500/35" }
} as const;

const WORDS = {
  element: {
    here: "Changed on this element at this breakpoint and state",
    elsewhere: "Changed on this element at another breakpoint or state"
  },
  classes: {
    here: "Set by the class being edited at this breakpoint and state",
    elsewhere: "Set by a class applied to this element"
  }
} as const;

function Dot({
  kind,
  level,
  decorative
}: {
  kind: "element" | "classes";
  level: Exclude<MarkLevel, "none">;
  decorative: boolean;
}) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : WORDS[kind][level]}
      aria-hidden={decorative || undefined}
      title={WORDS[kind][level]}
      data-dot={`${kind}-${level}`}
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR[kind][level]}`}
    />
  );
}

/** Up to two dots (`decorative` inside buttons, so the dots do not change the button name): yellow (this element) then blue (classes). Nothing when neither applies. */
export function ChangeDots({ marks, decorative = false }: { marks: Marks; decorative?: boolean }) {
  if (marks.element === "none" && marks.classes === "none") return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {marks.element !== "none" ? (
        <Dot kind="element" level={marks.element} decorative={decorative} />
      ) : null}
      {marks.classes !== "none" ? (
        <Dot kind="classes" level={marks.classes} decorative={decorative} />
      ) : null}
    </span>
  );
}

/** The legacy single dot: bright yellow when `on`. */
export const ownMarks = (on: boolean): Marks => ({
  element: on ? "here" : "none",
  classes: "none"
});
