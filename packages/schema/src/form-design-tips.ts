// Plain-words hints for the Form design settings (shown through the (i) beside each setting). One
// line per CSS property; a part setting may carry its own `tip` instead (input-design.ts). A test
// checks that every setting of every part has one.

import { FORM_DESIGN_PARTS } from "./choice-design";
import type { InputDesignProp } from "./input-design";

export const FORM_PROP_TIPS: Readonly<Record<string, string>> = {
  "--nxt-thumb":
    "The size of the round handle. The track area is as tall as the handle, and it also sets how far the handle can travel.",
  "align-items":
    "How the items line up across the row. Center puts them in the middle, stretch fills the height.",
  "align-self": "Overrides the alignment of just this part inside its parent.",
  "background-color":
    "The fill behind the part. Use a variable or a color, or transparent for none.",
  "background-image": "A gradient or image behind the part, drawn over the background color.",
  "border-color": "The color of the border line.",
  "border-radius": "How round the corners are. 50% makes a circle, 999px a pill.",
  "border-style": "The line style of the border. It needs a border width to show.",
  "border-width":
    "How thick the border is, for example 1px. Four values set top, right, bottom, left.",
  "box-shadow":
    "A shadow or glow around the part, for example 0 1px 2px rgba(0,0,0,.1). A ring uses 0 0 0 3px color.",
  "caret-color": "The color of the blinking text cursor while typing.",
  color: "The color of the text (or of the icon, which follows the text color).",
  "column-gap": "Space between columns only. Gap sets rows and columns together.",
  content: 'The text drawn by the part, written in quotes, for example " *". Use "" for nothing.',
  cursor:
    "The mouse pointer shown over the part. Pointer looks clickable, not-allowed looks disabled.",
  display:
    "How the part takes its place. None hides it, flex lines its content up, grid makes columns.",
  "flex-direction":
    "Which way content flows: row goes across, column goes down. Reverse flips the order.",
  "flex-wrap": "Wrap lets items move to the next line when they run out of room.",
  "font-family": "The typeface. Pick a project font or a system font.",
  "font-size": "The size of the text, for example 14px or 1rem. Icons follow it too.",
  "font-style": "Normal or italic.",
  "font-weight": "How bold the text is. 400 is regular, 600 semi-bold, 700 bold.",
  gap: "Space between the items inside the part.",
  "grid-template-columns":
    "The columns when Display is grid, for example repeat(2, 1fr) for two equal columns.",
  height: "The height of the part. Leave empty to fit the content.",
  "justify-content":
    "How the items spread along the row: start, center, end, or with space between.",
  left: "How far the tick sits from the left edge of its box.",
  "letter-spacing": "Space between letters, for example 0.02em.",
  "line-height": "Height of each line of text. 1.4 means 1.4 times the font size.",
  margin:
    "Space outside the part, pushing neighbours away. Four values set top, right, bottom, left.",
  "margin-left": "Space between the label and the marker.",
  "max-width": "The part never grows wider than this.",
  "min-height": "The part never gets shorter than this.",
  "min-width": "The part never gets narrower than this.",
  opacity: "How see-through the part is. 1 is solid, 0 is invisible.",
  order: "Position among its neighbours. Lowest comes first; -1 puts it first, a high number last.",
  "outline-color": "The color of the focus ring.",
  "outline-offset": "Gap between the part and its focus ring. Negative moves the ring inside.",
  "outline-style": "The line style of the focus ring.",
  "outline-width": "How thick the focus ring is. It does not take up space.",
  padding:
    "Space inside the part, between its edge and its content. Four values set top, right, bottom, left.",
  resize: "Whether a text area can be dragged larger, and in which direction.",
  "row-gap": "Space between rows only. Gap sets rows and columns together.",
  "text-align": "Where the text sits in its line: left, center or right.",
  "text-decoration": "Underline or strike-through for the text.",
  "text-transform":
    "Changes the letter case of the text without editing it, for example uppercase.",
  top: "How far the tick sits from the top edge of its box.",
  transform: "Moves, turns or scales the part, for example rotate(45deg).",
  transition: "Animates changes between states, for example all .15s ease.",
  width: "The width of the part. 100% fills its parent."
};

/** The hint of one setting: its own tip, else the one for its CSS property. */
export function formPropTip(item: InputDesignProp): string | undefined {
  return item.tip ?? FORM_PROP_TIPS[item.prop];
}

/** Settings of any part with no hint (empty when the table is complete). */
export function formPropsWithoutTip(): string[] {
  const missing: string[] = [];
  for (const part of FORM_DESIGN_PARTS)
    for (const group of part.groups)
      for (const item of group.props)
        if (!formPropTip(item)) missing.push(`${part.id}.${item.prop}`);
  return missing;
}
