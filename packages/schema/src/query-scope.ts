import type { ElementNode } from "./element";
import { activeQuery } from "./query";

// Who can read a query loop's values: only the element's descendants (owner decision), never the
// element itself, its parents or its siblings. Inside a loop, `item` is the current row and
// `index` its position; in nested loops the outer loop is `parent` (`parent.item`,
// `parent.parent.item`, ...).

/** Loop values one loop level gives its descendants. */
export interface LoopFrame {
  item: unknown;
  index: number;
}

/**
 * The expression scope inside loops: `frames[0]` is the innermost loop. Without frames the scope
 * is returned unchanged, so `item` and `index` stay unknown names (an out-of-scope tag).
 */
export function withLoopScope(
  scope: Readonly<Record<string, unknown>>,
  frames: readonly LoopFrame[]
): Record<string, unknown> {
  if (frames.length === 0) return { ...scope };
  const nest = (at: number): Record<string, unknown> | undefined => {
    const frame = frames[at];
    if (!frame) return undefined;
    const outer = nest(at + 1);
    return { item: frame.item, index: frame.index, ...(outer ? { parent: outer } : {}) };
  };
  return { ...scope, ...nest(0) };
}

/** How many query loops enclose each element (its own query does not count), by element id. */
export function loopDepths(root: ElementNode): Map<string, number> {
  const depths = new Map<string, number>();
  const visit = (node: ElementNode, depth: number) => {
    depths.set(node.id, depth);
    const inner = activeQuery(node) ? depth + 1 : depth;
    node.children.forEach((child) => visit(child, inner));
  };
  visit(root, 0);
  return depths;
}

/** The query loop elements around an element, innermost first (the element itself excluded). */
export function loopAncestors(root: ElementNode, elementId: string): ElementNode[] {
  const path: ElementNode[] = [];
  const find = (node: ElementNode): boolean => {
    if (node.id === elementId) return true;
    path.push(node);
    if (node.children.some(find)) return true;
    path.pop();
    return false;
  };
  if (!find(root)) return [];
  return path.filter((node) => activeQuery(node) !== null).reverse();
}
