import { loopDepths, type ElementNode } from "@nextomic/schema";

/** Elements outside query loops: only these are redrawn alone (loop rows need row values). */
export function loopFreeIds(tree: ElementNode): Set<string> {
  const free = new Set<string>();
  for (const [id, depth] of loopDepths(tree)) if (depth === 0) free.add(id);
  return free;
}
