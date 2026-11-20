import type { FragmentPart } from "./payload";

// DOM work of the action runtime: swapping redrawn elements in.

/** The live element of a node, or its empty slot when its conditions fail. */
export function placeOf(root: ParentNode, id: string): Element | null {
  const sel = CSS.escape(id);
  return (
    root.querySelector(`[data-nid="${sel}"]`) ??
    root.querySelector(`template[data-nx-slot="${sel}"]`)
  );
}

/** Drops ids inside another requested element: redrawing the outer one covers them. */
export function outermost(ids: readonly string[], root: ParentNode): string[] {
  const places = new Map<string, Element>();
  for (const id of ids) {
    const place = placeOf(root, id);
    if (place) places.set(id, place);
  }
  return [...places]
    .filter(([, el]) => [...places.values()].every((other) => other === el || !other.contains(el)))
    .map(([id]) => id);
}

function cssSlot(id: string): HTMLStyleElement {
  const sel = `style[data-nx-css="${CSS.escape(id)}"]`;
  const found = document.head.querySelector<HTMLStyleElement>(sel);
  if (found) return found;
  const style = document.createElement("style");
  style.dataset.nxCss = id;
  document.head.append(style);
  return style;
}

// Attributes a redraw may change on a live form field. Everything else (value, checked, type of a
// password toggle, aria-invalid, data-invalid, data-valid, hidden, open popovers) belongs to the
// visitor or the form runtime, so it is never overwritten.
const PATCHABLE = new Set([
  "disabled",
  "required",
  "readonly",
  "placeholder",
  "name",
  "min",
  "max",
  "step",
  "minlength",
  "maxlength",
  "pattern",
  "autocomplete",
  "inputmode",
  "aria-disabled",
  "aria-required",
  "aria-describedby",
  "data-nxt-rules",
  "data-required"
]);

/** The element tags and the text of leaf elements the form runtime does not write to. */
function shapeOf(el: Element): string {
  const own = (e: Element): string => {
    const kids = [...e.children];
    const managed = e.matches(
      "[data-nxt-error], [data-nxt-success], [data-nxt-trigger], [data-nxt-clear]"
    );
    const text = kids.length === 0 && !managed ? (e.textContent ?? "") : "";
    return `<${e.localName}>${text}${kids.map(own).join("")}</>`;
  };
  return own(el);
}

/**
 * A redrawn form field keeps its live element (typed text, focus, errors, an open popover) when
 * only attributes changed: the new attributes in PATCHABLE are copied over. Returns false when the
 * markup differs (options, labels or texts changed), and the caller replaces the field.
 */
function patchField(live: Element, fresh: Element): boolean {
  if (!live.matches("[data-nxt-field]") || shapeOf(live) !== shapeOf(fresh)) return false;
  const pairs: [Element, Element][] = [[live, fresh]];
  const walk = (a: Element, b: Element) => {
    [...a.children].forEach((child, i) => {
      const other = b.children[i];
      if (!other) return;
      pairs.push([child, other]);
      walk(child, other);
    });
  };
  walk(live, fresh);
  for (const [a, b] of pairs) {
    for (const name of PATCHABLE) {
      const next = b.getAttribute(name);
      if (next === null) a.removeAttribute(name);
      else if (a.getAttribute(name) !== next) a.setAttribute(name, next);
    }
  }
  return true;
}

/** Puts redrawn parts in place; returns the elements that were inserted. */
export function swapParts(parts: readonly FragmentPart[]): Element[] {
  const inserted: Element[] = [];
  for (const part of parts) {
    const place = placeOf(document, part.id);
    if (!place) continue;
    const range = document.createRange();
    range.selectNode(place);
    const fragment = range.createContextualFragment(part.html);
    const fresh = [...fragment.children];
    const [first] = fresh;
    if (fresh.length === 1 && first && patchField(place, first)) {
      cssSlot(part.id).textContent = part.css;
      continue;
    }
    place.replaceWith(fragment);
    cssSlot(part.id).textContent = part.css;
    inserted.push(...fresh.filter((el) => el.hasAttribute("data-nid")));
  }
  return inserted;
}
