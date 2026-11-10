import {
  cssAnimationKeyframes,
  cssAnimationName,
  overlayZIndex,
  type Overlay,
  type OverlayTemplateType
} from "@nextomic/schema";
import type { OverlayPart } from "./payload";

// The overlay layer for modal and bottom sheet templates (owner decision 2026-11-11). Each one is
// a fixed layer over the page, capped at the viewport, with its own overlay behind it. Stacking
// follows the bands in `Z_BANDS` plus the template's "Show above" rank. The template's design is
// the content; this file adds only the layer, focus handling, dismissal and the sheet's drag.

export interface ShowOverlayOptions {
  /** Each overrides the template's own value when set. */
  overlayDisabled?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  noOverlayDismiss?: boolean;
  /** Bottom sheet only. */
  noDrag?: boolean;
}

interface OpenOverlay {
  templateId: string;
  type: OverlayTemplateType;
  root: HTMLElement;
  restoreFocus: Element | null;
  close: () => void;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const DRAG_START_PX = 4;
const SNAP_BACK_MS = 200;

function cssSlot(templateId: string): HTMLStyleElement {
  const sel = `style[data-nx-overlay-css="${CSS.escape(templateId)}"]`;
  const found = document.head.querySelector<HTMLStyleElement>(sel);
  if (found) return found;
  const style = document.createElement("style");
  style.dataset.nxOverlayCss = templateId;
  document.head.append(style);
  return style;
}

/** Lets a sheet be dragged down: past a third of its height (or a quick flick) it closes. */
function enableDrag(content: HTMLElement, close: () => void): void {
  let startY = 0;
  let startAt = 0;
  let offset = 0;
  let pressed = false;
  let dragging = false;
  content.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable]"))
      return;
    pressed = true;
    dragging = false;
    startY = e.clientY;
    startAt = e.timeStamp;
    offset = 0;
  });
  content.addEventListener("pointermove", (e) => {
    if (!pressed) return;
    offset = Math.max(0, e.clientY - startY);
    if (!dragging && offset > DRAG_START_PX) {
      dragging = true;
      content.setPointerCapture(e.pointerId);
      content.style.transition = "none";
    }
    if (dragging) content.style.transform = `translateY(${offset}px)`;
  });
  const release = (e: PointerEvent) => {
    if (!pressed) return;
    pressed = false;
    if (!dragging) return;
    // A drag must not also count as a click on what is under the finger.
    content.addEventListener("click", (c) => c.stopPropagation(), { capture: true, once: true });
    const quick = offset / Math.max(1, e.timeStamp - startAt) > 0.5 && offset > 40;
    content.style.transition = `transform ${SNAP_BACK_MS}ms ease`;
    if (offset > content.offsetHeight * 0.3 || quick) {
      content.style.transform = "translateY(100%)";
      window.setTimeout(close, SNAP_BACK_MS);
    } else {
      content.style.transform = "";
    }
  };
  content.addEventListener("pointerup", release);
  content.addEventListener("pointercancel", release);
}

export interface OverlayLayer {
  show: (part: OverlayPart, options?: ShowOverlayOptions) => void;
  /** Closes the template's overlay, or the topmost one of that type when no id is given. */
  close: (type: OverlayTemplateType, templateId?: string) => void;
  isOpen: (templateId: string) => boolean;
  /** Closes everything and removes the listeners. */
  destroy: () => void;
}

/** `onInsert` runs for the content of every overlay that opens (the page binds its triggers). */
export function createOverlayLayer(onInsert?: (content: Element) => void): OverlayLayer {
  const open: OpenOverlay[] = [];
  let opened = 0;
  let scrollWas: string | null = null;

  const top = (): OpenOverlay | undefined =>
    [...open].sort((a, b) => Number(a.root.style.zIndex) - Number(b.root.style.zIndex)).pop();

  const onKey = (e: KeyboardEvent) => {
    const current = top();
    if (!current) return;
    if (e.key === "Escape") {
      e.preventDefault();
      current.close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = [...current.root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const content = current.root.querySelector<HTMLElement>("[data-nx-overlay-content]");
    if (items.length === 0) {
      e.preventDefault();
      content?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!first || !last) return;
    if (e.shiftKey && (active === first || active === content)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const remove = (entry: OpenOverlay) => {
    const at = open.indexOf(entry);
    if (at < 0) return;
    open.splice(at, 1);
    entry.root.remove();
    document.head
      .querySelector(`style[data-nx-overlay-css="${CSS.escape(entry.templateId)}"]`)
      ?.remove();
    document.head
      .querySelector(`style[data-nx-overlay-anim="${CSS.escape(entry.templateId)}"]`)
      ?.remove();
    if (open.length === 0) {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = scrollWas ?? "";
      scrollWas = null;
    }
    if (entry.restoreFocus instanceof HTMLElement) entry.restoreFocus.focus();
  };

  const show = (part: OverlayPart, options: ShowOverlayOptions = {}) => {
    // One layer per template: showing it again replaces it.
    const again = open.find((o) => o.templateId === part.templateId);
    if (again) remove(again);
    const sheet = part.type === "bottom-sheet";
    const settings: Overlay = {
      disabled: options.overlayDisabled ?? part.overlay.disabled,
      color: options.overlayColor || part.overlay.color,
      opacity: options.overlayOpacity ?? part.overlay.opacity
    };
    if (open.length === 0) {
      scrollWas = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey, true);
    }
    opened += 1;
    const root = document.createElement("div");
    root.dataset.nxOverlay = part.type;
    root.dataset.nxOverlayId = part.templateId;
    root.style.cssText = `position:fixed;inset:0;max-width:100vw;max-height:100dvh;overflow:hidden;display:flex;justify-content:center;align-items:${sheet ? "flex-end" : "center"};z-index:${overlayZIndex(part.type, part.rank, opened)}`;

    const backdrop = document.createElement("div");
    backdrop.dataset.nxOverlayBackdrop = "";
    backdrop.style.cssText = "position:absolute;inset:0";
    if (!settings.disabled) {
      backdrop.style.background = settings.color;
      backdrop.style.opacity = String(settings.opacity);
    }

    const content = document.createElement("div");
    content.dataset.nxOverlayContent = "";
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");
    content.tabIndex = -1;
    // The children stack in a column, centered (modal) or full width (sheet), as in the editor canvas.
    content.style.cssText = `position:relative;max-width:100vw;max-height:100dvh;overflow:auto;display:flex;flex-direction:column;align-items:${sheet ? "stretch" : "center"};${sheet ? "width:100%;" : ""}`;
    content.append(document.createRange().createContextualFragment(part.html));
    root.append(backdrop, content);

    // Children keep their size (the column scrolls instead of squashing them).
    cssSlot(part.templateId).textContent =
      `[data-nx-overlay-id="${CSS.escape(part.templateId)}"] [data-nx-overlay-content]>*{flex:none}${part.css}`;
    const entry: OpenOverlay = {
      templateId: part.templateId,
      type: part.type,
      root,
      restoreFocus: document.activeElement,
      close: () => remove(entry)
    };
    open.push(entry);
    if (!options.noOverlayDismiss) backdrop.addEventListener("click", entry.close);

    if (sheet) {
      const { animation, durationMs, delayMs } = part.entry;
      const frames = cssAnimationKeyframes([animation]);
      if (frames) {
        const style = document.createElement("style");
        style.dataset.nxOverlayAnim = part.templateId;
        style.textContent = frames;
        document.head.append(style);
        content.style.animation = `${cssAnimationName(animation)} ${durationMs}ms ease ${delayMs}ms both`;
        // The animation would override the drag's inline transform while it holds its end state.
        content.addEventListener("animationend", () => (content.style.animation = "none"), {
          once: true
        });
      }
      if (!options.noDrag) {
        const scrollable = content.scrollHeight > content.clientHeight;
        document.body.append(root);
        if (!scrollable) content.style.touchAction = "none";
        enableDrag(content, entry.close);
        content.focus({ preventScroll: true });
        onInsert?.(content);
        return;
      }
    }
    document.body.append(root);
    content.focus({ preventScroll: true });
    onInsert?.(content);
  };

  const close = (type: OverlayTemplateType, templateId?: string) => {
    const target = templateId
      ? open.find((o) => o.templateId === templateId)
      : [...open]
          .filter((o) => o.type === type)
          .sort((a, b) => Number(a.root.style.zIndex) - Number(b.root.style.zIndex))
          .pop();
    if (target) remove(target);
  };

  return {
    show,
    close,
    isOpen: (templateId) => open.some((o) => o.templateId === templateId),
    destroy: () => {
      for (const entry of [...open]) remove(entry);
    }
  };
}
