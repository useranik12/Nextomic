// Where to put a floating box (tooltip, small popup) next to an anchor so it always stays on screen:
// above the anchor when there is room, else below, else whichever side has more room; centered on
// the anchor and pushed back inside the viewport (with a gutter) when it would overflow a side.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  side: "top" | "bottom";
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export function placeFloating(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  options: { gap?: number; gutter?: number; prefer?: "top" | "bottom" } = {}
): Placement {
  const gap = options.gap ?? 6;
  const gutter = options.gutter ?? 8;
  const roomAbove = anchor.top - gap - gutter;
  const roomBelow = viewport.height - (anchor.top + anchor.height) - gap - gutter;
  const fits = { top: size.height <= roomAbove, bottom: size.height <= roomBelow };
  const prefer = options.prefer ?? "top";
  const other = prefer === "top" ? "bottom" : "top";
  const side = fits[prefer]
    ? prefer
    : fits[other]
      ? other
      : roomAbove >= roomBelow
        ? "top"
        : "bottom";
  const top = side === "top" ? anchor.top - gap - size.height : anchor.top + anchor.height + gap;
  const left = anchor.left + anchor.width / 2 - size.width / 2;
  return {
    side,
    left: clamp(left, gutter, viewport.width - gutter - size.width),
    top: clamp(top, gutter, viewport.height - gutter - size.height)
  };
}
