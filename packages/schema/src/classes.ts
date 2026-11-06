import { walkElements } from "./element";
import type { ElementNode } from "./element";

/** Adds, per class name, how many elements in `root` use it. */
export function countClassUsage(
  root: ElementNode,
  counts: Record<string, number> = {}
): Record<string, number> {
  walkElements(root, (node) => {
    for (const name of node.classIds) counts[name] = (counts[name] ?? 0) + 1;
  });
  return counts;
}

/**
 * Renames `from` to `to`, or removes it when `to` is null, on every element. An element that
 * already has `to` just loses `from`. Returns true when anything changed.
 */
export function replaceClassInTree(root: ElementNode, from: string, to: string | null): boolean {
  let changed = false;
  walkElements(root, (node) => {
    const at = node.classIds.indexOf(from);
    if (at < 0) return;
    changed = true;
    if (to === null || node.classIds.includes(to)) node.classIds.splice(at, 1);
    else node.classIds[at] = to;
  });
  return changed;
}
