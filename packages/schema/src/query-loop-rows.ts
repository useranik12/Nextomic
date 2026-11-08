import type { ElementNode } from "./element";
import { activeQuery, type ElementQuery } from "./query";
import { fillWith, type QueryRows } from "./query-run";
import { withLoopScope, type LoopFrame } from "./query-scope";

// Which query loops a page runs and the rows each one got. A loop inside another loop runs once
// per outer row, so a loop is identified by its place: the outer loops' element ids and row
// positions, then its own id (`outer#2/inner`). Rows are kept by that key for one render only.

/** One enclosing loop row on the way to an element. */
export interface LoopStep {
  id: string;
  index: number;
}

/** The key of one run of a query loop element. */
export const loopKey = (path: readonly LoopStep[], id: string): string =>
  [...path.map((s) => `${s.id}#${s.index}`), id].join("/");

/** Rows of every loop run that finished, by `loopKey`. */
export type LoopRows = Readonly<Record<string, QueryRows>>;

/** One run of a query loop element: where it is and the loop values around it. */
export interface LoopInstance {
  key: string;
  node: ElementNode;
  query: ElementQuery;
  /** Enclosing loop rows, innermost first (for `withLoopScope`). */
  frames: LoopFrame[];
  path: LoopStep[];
}

/**
 * The loop runs that can happen now, outer loops first: every loop whose enclosing loops have
 * rows. A loop below one without rows yet waits for them. At most `max` runs are listed.
 */
export function loopInstances(root: ElementNode, rows: LoopRows, max = 200): LoopInstance[] {
  const out: LoopInstance[] = [];
  const visit = (node: ElementNode, path: LoopStep[], frames: LoopFrame[]) => {
    if (node.hidden || out.length >= max) return;
    const query = activeQuery(node);
    if (!query) {
      for (const child of node.children) visit(child, path, frames);
      return;
    }
    const key = loopKey(path, node.id);
    out.push({ key, node, query, frames, path });
    const result = rows[key];
    if (!result) return;
    result.rows.forEach((item, index) => {
      const innerPath = [...path, { id: node.id, index }];
      const innerFrames = [{ item, index }, ...frames];
      for (const child of node.children) visit(child, innerPath, innerFrames);
    });
  };
  visit(root, [], []);
  return out.slice(0, max);
}

/** Runs one loop with its templates filled from the given fill function. */
export type LoopRunner = (
  instance: LoopInstance,
  fill: (template: string) => string
) => Promise<QueryRows>;

const NO_ROWS: QueryRows = { rows: [], hasMore: false };

/**
 * Runs every query loop of a page, outer loops first, inner loops once per outer row (in
 * parallel per level), until all ran or `max` runs were made. A loop that fails gets no rows,
 * so a broken query shows nothing instead of breaking the page. `scope` is the page's
 * expression scope; each run fills its templates with its enclosing loop values added.
 */
export async function collectLoopRows(
  root: ElementNode,
  scope: Readonly<Record<string, unknown>>,
  run: LoopRunner,
  max = 200
): Promise<Record<string, QueryRows>> {
  const rows: Record<string, QueryRows> = {};
  for (;;) {
    const pending = loopInstances(root, rows, max).filter((i) => !(i.key in rows));
    if (pending.length === 0) break;
    const results = await Promise.all(
      pending.map((instance) =>
        run(instance, fillWith(withLoopScope(scope, instance.frames))).catch(() => NO_ROWS)
      )
    );
    pending.forEach((instance, at) => {
      rows[instance.key] = results[at] ?? NO_ROWS;
    });
  }
  return rows;
}
