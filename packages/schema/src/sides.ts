// Properties that have a value per side (margin, padding, border width, inset) or per corner
// (border radius). The Design tab edits the four values on their own; this keeps the stored
// declarations tidy: one shorthand while all four are equal, four longhands otherwise, never both.

export type FourValues = [
  string | undefined,
  string | undefined,
  string | undefined,
  string | undefined
];

export interface SideSet {
  id: string;
  /** Longhands in CSS shorthand order: top, right, bottom, left (corners: TL, TR, BR, BL). */
  props: [string, string, string, string];
  /** The shorthand that can hold all four equal values; absent when none exists. */
  shorthand?: string;
  kind: "sides" | "corners";
}

export const SIDE_SETS: Record<string, SideSet> = {
  margin: {
    id: "margin",
    kind: "sides",
    shorthand: "margin",
    props: ["margin-top", "margin-right", "margin-bottom", "margin-left"]
  },
  padding: {
    id: "padding",
    kind: "sides",
    shorthand: "padding",
    props: ["padding-top", "padding-right", "padding-bottom", "padding-left"]
  },
  inset: { id: "inset", kind: "sides", props: ["top", "right", "bottom", "left"] },
  "border-width": {
    id: "border-width",
    kind: "sides",
    shorthand: "border-width",
    props: ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"]
  },
  "border-radius": {
    id: "border-radius",
    kind: "corners",
    shorthand: "border-radius",
    props: [
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius"
    ]
  }
};

/** Splits a value on spaces outside brackets: `1px calc(1px + 2px)` gives two parts. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/** The four values of a 1 to 4 value shorthand (`0 auto` is top/bottom 0, left/right auto); null if invalid. */
export function expandShorthand(value: string): FourValues | null {
  const p = splitTopLevel(value);
  const [a, b = a, c = a, d = b] = p;
  if (p.length < 1 || p.length > 4 || a === undefined) return null;
  return [a, b, c, d];
}

type Declarations = Readonly<Record<string, string>> | undefined;

/** The value of each side as set in one set of declarations; longhands win over the shorthand. */
export function readSides(declarations: Declarations, set: SideSet): FourValues {
  const fromShort =
    set.shorthand && declarations?.[set.shorthand] !== undefined
      ? expandShorthand(declarations[set.shorthand] as string)
      : null;
  return set.props.map((prop, i) => declarations?.[prop] ?? fromShort?.[i]) as FourValues;
}

/**
 * Declarations to change so the sides hold `values` (undefined = not set). `null` removes a
 * declaration. Four equal values collapse into the shorthand; otherwise only longhands are kept.
 */
export function sidesPatch(values: FourValues, set: SideSet): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  const [first] = values;
  const equal = first !== undefined && values.every((v) => v === first);
  if (equal && set.shorthand) {
    patch[set.shorthand] = first;
    for (const prop of set.props) patch[prop] = null;
    return patch;
  }
  if (set.shorthand) patch[set.shorthand] = null;
  set.props.forEach((prop, i) => {
    patch[prop] = values[i] ?? null;
  });
  return patch;
}

/** True when any side of the set is set in these declarations. */
export function hasSides(declarations: Declarations, set: SideSet): boolean {
  return (
    set.props.some((p) => declarations?.[p] !== undefined) ||
    (set.shorthand !== undefined && declarations?.[set.shorthand] !== undefined)
  );
}

/** How the four values relate: all equal, pairs equal (top/bottom and left/right), or free. */
export function sidesRelation(values: FourValues): "all" | "pairs" | "free" {
  const [t, r, b, l] = values;
  if (t === r && r === b && b === l) return "all";
  if (t === b && r === l) return "pairs";
  return "free";
}
