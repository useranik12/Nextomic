import { cssAnimationById, cssAnimationName, type ElementAnimationSpec } from "@nextomic/schema";

// Plays the ready-made CSS animations of elements (Design tab > Animations) in the browser.

const ONCE_PREFIX = "nxt-anim-once:";

function playedBefore(key: string): boolean {
  try {
    return window.sessionStorage.getItem(ONCE_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

function markPlayed(key: string): void {
  try {
    window.sessionStorage.setItem(ONCE_PREFIX + key, "1");
  } catch {
    // Storage can be blocked; the animation then simply plays every time.
  }
}

function query(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function owner(root: ParentNode, nodeId: string): Element | null {
  return query(root, `[data-nid="${CSS.escape(nodeId)}"]`)[0] ?? null;
}

function play(el: HTMLElement, spec: ElementAnimationSpec): void {
  el.style.opacity = "";
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = `${cssAnimationName(spec.animation)} ${spec.duration}s ease ${spec.delay}ms both`;
}

export interface CssAnimationHandle {
  destroy: () => void;
}

/** Wires every spec; the handle undoes the listeners and the styles (for route changes). */
export function startCssAnimations(
  specs: readonly ElementAnimationSpec[],
  root: ParentNode = document
): CssAnimationHandle {
  const cleanups: (() => void)[] = [];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const spec of specs) {
    const own = owner(root, spec.nodeId);
    const def = cssAnimationById(spec.animation);
    if (!own || !def) continue;
    const triggers = spec.triggerSelector.trim() ? query(root, spec.triggerSelector) : [own];
    const targetsOf = () =>
      (spec.target === "self" ? [own] : query(root, spec.targetSelector)).filter(
        (el): el is HTMLElement => el instanceof HTMLElement
      );
    const key = spec.nodeId;
    const done = spec.once && playedBefore(key);

    // Entrance animations start invisible, unless motion is reduced or they already ran this session.
    if (def.entrance && !reduced && !done) {
      for (const el of targetsOf()) el.style.opacity = "0";
    }
    cleanups.push(() => {
      for (const el of targetsOf()) {
        el.style.animation = "";
        el.style.opacity = "";
      }
    });
    if (reduced || triggers.length === 0) continue;

    const fire = () => {
      if (spec.once) {
        if (playedBefore(key)) return;
        markPlayed(key);
      }
      for (const el of targetsOf()) play(el, spec);
    };
    const on = (el: Element | Window, type: string, handler: () => void) => {
      el.addEventListener(type, handler);
      cleanups.push(() => el.removeEventListener(type, handler));
    };

    if (spec.trigger === "load") fire();
    else if (spec.trigger === "click") triggers.forEach((el) => on(el, "click", fire));
    else if (spec.trigger === "hover") triggers.forEach((el) => on(el, "mouseenter", fire));
    else if (spec.trigger === "focus") triggers.forEach((el) => on(el, "focusin", fire));
    else if (spec.trigger === "scroll") {
      let past = false;
      const check = () => {
        const now = window.scrollY >= spec.scrollOffset;
        if (now && !past) fire();
        past = now;
      };
      on(window, "scroll", check);
      check();
    } else {
      const wantEnter = spec.trigger === "enter-view";
      const seen = new Map<Element, boolean>();
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const before = seen.get(entry.target);
          seen.set(entry.target, entry.isIntersecting);
          if (wantEnter ? entry.isIntersecting : before === true && !entry.isIntersecting) fire();
        }
      });
      triggers.forEach((el) => observer.observe(el));
      cleanups.push(() => observer.disconnect());
    }
  }

  return { destroy: () => cleanups.forEach((fn) => fn()) };
}
