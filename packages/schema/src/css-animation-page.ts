import { cssAnimationById, cssAnimationKeyframes, type ElementAnimation } from "./css-animation";
import { STICKY_ATTRIBUTE } from "./compose";
import { walkElements, type ElementNode } from "./element";

/** What the runtime needs to wire one element's animation. */
export interface ElementAnimationSpec extends ElementAnimation {
  /** The `data-nid` of the element that owns the setting. */
  nodeId: string;
}

/** Every element animation in a page tree that has an animation chosen. */
export function collectElementAnimations(tree: ElementNode): ElementAnimationSpec[] {
  const specs: ElementAnimationSpec[] = [];
  walkElements(tree, (node) => {
    if (node.animation && cssAnimationById(node.animation.animation)) {
      specs.push({ ...node.animation, nodeId: node.id });
    }
  });
  return specs;
}

/** The keyframes CSS a page needs for its element animations. */
export function elementAnimationCss(tree: ElementNode): string {
  const ids = collectElementAnimations(tree).map((s) => s.animation);
  walkElements(tree, (node) => {
    const raw = node.attributes?.[STICKY_ATTRIBUTE];
    if (typeof raw !== "string") return;
    try {
      const spec = JSON.parse(raw) as { animation?: unknown };
      if (typeof spec.animation === "string") ids.push(spec.animation);
    } catch {
      // A broken attribute simply adds no keyframes.
    }
  });
  return cssAnimationKeyframes(ids);
}
