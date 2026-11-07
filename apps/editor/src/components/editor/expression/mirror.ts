import { splitTemplate } from "@nextomic/schema";
import type { TextField } from "./expression-field";

// The overlay that draws a field's text with its {{tags}} highlighted. It sits right after the
// field, over it, with the same box and font; the field's own glyphs are transparent so only the
// caret and the selection show through. Plain DOM: it follows the field, not React state.

const COPIED = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textIndent",
  "textAlign",
  "tabSize",
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopLeftRadius"
] as const;

export interface Mirror {
  box: HTMLDivElement;
  inner: HTMLDivElement;
  /** What the spans were last built from. */
  key: string;
  /** Last box geometry, to skip unchanged updates. */
  geometry: string;
}

export function createMirror(field: TextField): Mirror {
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.className = "nx-expr-mirror";
  Object.assign(box.style, {
    position: "absolute",
    margin: "0",
    overflow: "hidden",
    pointerEvents: "none",
    borderStyle: "solid",
    borderColor: "transparent",
    background: "transparent",
    zIndex: "1"
  });
  const inner = document.createElement("div");
  box.append(inner);
  field.insertAdjacentElement("afterend", box);
  field.setAttribute("data-expr-mirrored", "");
  return { box, inner, key: "", geometry: "" };
}

export function removeMirror(field: TextField, mirror: Mirror): void {
  mirror.box.remove();
  field.removeAttribute("data-expr-mirrored");
}

/** Keeps the overlay on the field: same box, font, line layout and scroll. */
export function syncGeometry(field: TextField, mirror: Mirror): void {
  const multiline = field instanceof HTMLTextAreaElement;
  const geometry = [
    field.offsetLeft,
    field.offsetTop,
    field.offsetWidth,
    field.offsetHeight,
    field.clientWidth
  ].join(",");
  if (geometry !== mirror.geometry) {
    mirror.geometry = geometry;
    const style = getComputedStyle(field);
    const box = mirror.box.style;
    for (const name of COPIED) box[name] = style[name];
    box.borderRadius = style.borderRadius;
    box.left = `${field.offsetLeft}px`;
    box.top = `${field.offsetTop}px`;
    box.width = `${field.offsetWidth}px`;
    box.height = `${field.offsetHeight}px`;
    // A textarea's scrollbar takes width from the text; keep the same wrap width.
    const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const scrollbar = field.offsetWidth - field.clientWidth - borders;
    box.paddingRight = `${parseFloat(style.paddingRight) + Math.max(scrollbar, 0)}px`;
    const inner = mirror.inner.style;
    inner.whiteSpace = multiline ? "pre-wrap" : "pre";
    inner.overflowWrap = multiline ? "break-word" : "normal";
    // A one-line input centers its line in the box; a line as tall as the content box does too.
    const content =
      field.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    inner.lineHeight = multiline ? style.lineHeight : `${content}px`;
  }
  mirror.inner.style.transform = `translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`;
}

/** Rebuilds the text with a span per {{tag}}; `bad` says which tags have a problem. */
export function fillMirror(mirror: Mirror, value: string, bad: (expr: string) => boolean): void {
  const nodes: Node[] = [];
  let at = 0;
  for (const part of splitTemplate(value)) {
    if (typeof part === "string") continue;
    if (part.start > at) nodes.push(document.createTextNode(value.slice(at, part.start)));
    const span = document.createElement("span");
    span.className = bad(part.expr) ? "nx-expr-bad" : "nx-expr-tag";
    span.dataset.expr = part.expr;
    span.textContent = value.slice(part.start, part.end);
    nodes.push(span);
    at = part.end;
  }
  // A trailing newline needs a character after it to take up its line.
  nodes.push(document.createTextNode(value.slice(at) + (value.endsWith("\n") ? "​" : "")));
  mirror.inner.replaceChildren(...nodes);
}

/** The tag under the pointer, if any. */
export function tagAt(mirror: Mirror, x: number, y: number): HTMLSpanElement | null {
  for (const span of mirror.inner.querySelectorAll<HTMLSpanElement>("span[data-expr]"))
    for (const rect of span.getClientRects())
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return span;
  return null;
}
