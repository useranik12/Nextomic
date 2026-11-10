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

const POSITIONS: Record<string, string> = {
  "top-left": "top:16px;left:16px;align-items:flex-start",
  "top-center": "top:16px;left:50%;transform:translateX(-50%);align-items:center",
  "top-right": "top:16px;right:16px;align-items:flex-end",
  "bottom-left": "bottom:16px;left:16px;align-items:flex-start",
  "bottom-center": "bottom:16px;left:50%;transform:translateX(-50%);align-items:center",
  "bottom-right": "bottom:16px;right:16px;align-items:flex-end"
};

function toastStack(position: string): HTMLElement {
  const key = POSITIONS[position] ? position : "bottom-right";
  const sel = `[data-nx-toasts="${key}"]`;
  const found = document.querySelector<HTMLElement>(sel);
  if (found) return found;
  const stack = document.createElement("div");
  stack.dataset.nxToasts = key;
  stack.setAttribute("aria-live", "polite");
  stack.style.cssText = `position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:8px;pointer-events:none;${POSITIONS[key]}`;
  document.body.append(stack);
  return stack;
}

let toastCount = 0;

/** Shows a rendered toast; it closes after `durationMs` or on its close button. */
export function showToastHtml(html: string, css: string, position: string, durationMs: number) {
  const item = document.createElement("div");
  // Each toast keeps its own styles: two toasts of different types share element ids.
  const key = String((toastCount += 1));
  item.dataset.nxToastItem = key;
  item.style.cssText =
    "pointer-events:auto;transition:opacity .2s ease,transform .2s ease;opacity:0;transform:translateY(6px)";
  const style = document.createElement("style");
  style.textContent = `[data-nx-toast-item="${key}"]{${css}}`;
  item.append(style, document.createRange().createContextualFragment(html));
  toastStack(position).append(item);
  requestAnimationFrame(() => {
    item.style.opacity = "1";
    item.style.transform = "none";
  });
  let timer = 0;
  const close = () => {
    window.clearTimeout(timer);
    item.style.opacity = "0";
    window.setTimeout(() => item.remove(), 200);
  };
  timer = window.setTimeout(close, durationMs);
  item.querySelector("[data-nx-toast-close]")?.addEventListener("click", close);
}
