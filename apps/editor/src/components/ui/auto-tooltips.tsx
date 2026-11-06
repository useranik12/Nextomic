"use client";

import { useEffect, useRef, useState } from "react";

const DELAY_MS = 300;
const TARGET = "button,a,[role=button],[role=tab],[role=menuitem],[role=switch]";

interface Shown {
  text: string;
  rect: DOMRect;
}

/** The words for an element: its title, or its accessible name when it has no visible text. */
function labelOf(el: HTMLElement): string | null {
  if (el.hasAttribute("data-own-tip")) return null;
  const title = el.getAttribute("title")?.trim();
  if (title) return title;
  const aria = el.getAttribute("aria-label")?.trim();
  const iconOnly = (el.textContent ?? "").trim() === "";
  return aria && iconOnly ? aria : null;
}

/**
 * One tooltip for every icon button in the builder: hover (or keep the pointer) on it for 300 ms and
 * it says what the button does. Native `title` tooltips are replaced so two never show at once, and
 * elements that bring their own tooltip (InfoTip, HeroUI Tooltip) are left alone.
 */
export function AutoTooltips() {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | null>(null);
  const current = useRef<{ el: HTMLElement; title: string | null } | null>(null);

  useEffect(() => {
    function stop() {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      const active = current.current;
      if (active?.title != null && !active.el.hasAttribute("title")) {
        active.el.setAttribute("title", active.title);
      }
      current.current = null;
      setShown(null);
    }

    function onOver(event: PointerEvent) {
      const target =
        event.target instanceof Element ? event.target.closest<HTMLElement>(TARGET) : null;
      if (target === current.current?.el) return;
      stop();
      if (!target) return;
      const text = labelOf(target);
      if (!text) return;
      const title = target.getAttribute("title");
      if (title !== null) target.removeAttribute("title");
      current.current = { el: target, title };
      timer.current = window.setTimeout(() => {
        // A component's own tooltip is already open for this element.
        if (target.hasAttribute("aria-describedby")) return;
        setShown({ text, rect: target.getBoundingClientRect() });
      }, DELAY_MS);
    }

    window.addEventListener("pointerover", onOver, true);
    window.addEventListener("pointerdown", stop, true);
    window.addEventListener("keydown", stop, true);
    window.addEventListener("scroll", stop, true);
    document.addEventListener("pointerleave", stop);
    return () => {
      stop();
      window.removeEventListener("pointerover", onOver, true);
      window.removeEventListener("pointerdown", stop, true);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("scroll", stop, true);
      document.removeEventListener("pointerleave", stop);
    };
  }, []);

  if (!shown) return null;
  const below = shown.rect.top < 48;
  const left = Math.min(Math.max(8, shown.rect.left + shown.rect.width / 2), window.innerWidth - 8);
  return (
    <div
      role="tooltip"
      style={{
        left,
        top: below ? shown.rect.bottom + 6 : shown.rect.top - 6,
        transform: `translate(-50%, ${below ? "0" : "-100%"})`
      }}
      className="pointer-events-none fixed z-[2000] max-w-64 rounded-medium border border-divider bg-content1 px-2 py-1 text-center text-tiny text-foreground shadow-medium"
    >
      {shown.text}
    </div>
  );
}
