import type { FragmentPart } from "./payload";

// DOM work of the action runtime: swapping redrawn elements in, and the toast stack.

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
    place.replaceWith(fragment);
    cssSlot(part.id).textContent = part.css;
    inserted.push(...fresh.filter((el) => el.hasAttribute("data-nid")));
  }
  return inserted;
}

/**
 * Shows a rendered toast template. Its design (position, size, look) comes from the template; it
 * closes after `closeAfterMs` or when an element with `data-nx-toast-close` is clicked.
 */
export function showToastHtml(toast: { html: string; css: string; closeAfterMs: number }) {
  const item = document.createElement("div");
  // Each toast keeps its own styles: two toasts of one template share element ids.
  const key = String((toastCount += 1));
  item.dataset.nxToast = key;
  item.setAttribute("role", "status");
  item.setAttribute("aria-live", "polite");
  const style = document.createElement("style");
  style.textContent = `[data-nx-toast="${key}"]{${toast.css}}`;
  item.append(style, document.createRange().createContextualFragment(toast.html));
  document.body.append(item);
  const close = () => {
    window.clearTimeout(timer);
    item.remove();
  };
  const timer = window.setTimeout(close, toast.closeAfterMs);
  item.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-nx-toast-close]")) close();
  });
}

let toastCount = 0;
