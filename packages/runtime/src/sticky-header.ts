// Sticky header behavior for built pages: the header sticks to the top after a scroll distance,
// slides away after another, and can come back on scroll up. The settings sit on the header
// wrapper as JSON in `data-nxt-sticky` (see `composePage` in @nextomic/schema).

const ATTRIBUTE = "data-nxt-sticky";
const FIXED_CLASS = "nxt-sticky-fixed";

interface StickySpec {
  after: string;
  slideAfter: string;
  animation: string;
  duration: number;
  onScroll: boolean;
}

function readSpec(el: Element): StickySpec | null {
  try {
    const raw: unknown = JSON.parse(el.getAttribute(ATTRIBUTE) ?? "");
    if (!raw || typeof raw !== "object") return null;
    const spec = raw as Record<string, unknown>;
    if (typeof spec.animation !== "string") return null;
    return {
      after: typeof spec.after === "string" ? spec.after : "0px",
      slideAfter: typeof spec.slideAfter === "string" ? spec.slideAfter : "",
      animation: spec.animation,
      duration: typeof spec.duration === "number" ? spec.duration : 300,
      onScroll: spec.onScroll === true
    };
  } catch {
    return null;
  }
}

/** A CSS length in pixels (any unit the browser knows); null for empty or invalid text. */
function toPixels(value: string): number | null {
  const text = value.trim();
  if (text === "") return null;
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return Number(text);
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:0;width:${text}`;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return Number.isFinite(width) && probe.style.width !== "" ? width : null;
}

export interface StickyHeaderHandle {
  destroy: () => void;
}

/** Wires every sticky header in `root`; the handle undoes the listeners, classes and styles. */
export function startStickyHeaders(root: ParentNode = document): StickyHeaderHandle {
  const cleanups: (() => void)[] = [];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const outer of Array.from(root.querySelectorAll<HTMLElement>(`[${ATTRIBUTE}]`))) {
    const spec = readSpec(outer);
    const inner = outer.firstElementChild;
    if (!spec || !(inner instanceof HTMLElement)) continue;
    const name = `nxt-anim-${spec.animation}`;
    const duration = reduced ? 0 : spec.duration;
    let stuck = false;
    let hidden = false;
    let lastY = window.scrollY;
    let frame = 0;

    const setStuck = (next: boolean) => {
      if (next === stuck) return;
      stuck = next;
      if (next) {
        outer.style.minHeight = `${inner.offsetHeight}px`;
        inner.classList.add(FIXED_CLASS);
      } else {
        inner.classList.remove(FIXED_CLASS);
        outer.style.minHeight = "";
      }
    };

    const setHidden = (next: boolean, instant = false) => {
      if (next === hidden) return;
      hidden = next;
      inner.toggleAttribute("inert", next);
      if (instant) {
        inner.style.animation = "";
        return;
      }
      inner.style.animation = `${name} ${duration}ms ease ${next ? "" : "reverse "}both`;
    };

    const onEnd = () => {
      if (!hidden) inner.style.animation = "";
    };
    inner.addEventListener("animationend", onEnd);

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const after = toPixels(spec.after) ?? 0;
      const slide = toPixels(spec.slideAfter);
      setStuck(y > after);
      let hide = hidden;
      if (!stuck || slide === null || y <= slide) hide = false;
      else if (!spec.onScroll) hide = true;
      else if (y > lastY) hide = true;
      else if (y < lastY) hide = false;
      lastY = y;
      setHidden(hide, !stuck);
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();

    cleanups.push(() => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      inner.removeEventListener("animationend", onEnd);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      inner.classList.remove(FIXED_CLASS);
      inner.removeAttribute("inert");
      inner.style.animation = "";
      outer.style.minHeight = "";
    });
  }

  return { destroy: () => cleanups.forEach((fn) => fn()) };
}
