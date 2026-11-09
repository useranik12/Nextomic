import type { ElementNode } from "./element";
import { activeQuery } from "./query";

// Who can read a query loop's values: only the element's descendants (owner decision), never the
// element itself, its parents or its siblings. Each loop is read by its name with a % sign:
// `%posts.item` is the current row of the loop named "posts" and `%posts.index` its position, so
// nested loops are told apart by name (owner decision 2026-11-09).

/** Loop values one loop level gives its descendants. */
export interface LoopFrame {
  /** The loop's name (`ElementQuery.name`). */
  name: string;
  item: unknown;
  index: number;
}

/** The scope key of a loop: `%` and its name. */
export const loopScopeKey = (name: string) => `%${name}`;

/** The frame a loop element gives for one of its rows. */
export const loopFrame = (node: ElementNode, item: unknown, index: number): LoopFrame => ({
  name: node.query?.name ?? "",
  item,
  index
});

/**
 * The expression scope inside loops: `frames[0]` is the innermost loop. Each loop adds
 * `%name: { item, index }`. Without frames the scope is returned unchanged, so `%name` stays an
 * unknown name (an out-of-scope tag). A nameless loop (an old page not upgraded) adds nothing.
 */
export function withLoopScope(
  scope: Readonly<Record<string, unknown>>,
  frames: readonly LoopFrame[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...scope };
  // Outer first, so an inner loop wins if two loops around an element share a name.
  for (const frame of [...frames].reverse())
    if (frame.name) out[loopScopeKey(frame.name)] = { item: frame.item, index: frame.index };
  return out;
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
