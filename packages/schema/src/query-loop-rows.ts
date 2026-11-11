import type { ElementNode } from "./element";
import { activeQuery, type ElementQuery } from "./query";
import { localLoopRows } from "./query-local";
import { fillWith, type QueryRows } from "./query-run";
import { loopFrame, withLoopScope, type LoopFrame } from "./query-scope";

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

const KEY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A `loopKey` read back into the outer loop rows and the element id; null when malformed. */
export function parseLoopKey(key: string): { path: LoopStep[]; id: string } | null {
  const parts = key.split("/");
  if (parts.length === 0 || parts.length > 20) return null;
  const id = parts.pop() ?? "";
  if (!KEY_ID.test(id)) return null;
  const path: LoopStep[] = [];
  for (const part of parts) {
    const match = /^([A-Za-z0-9_-]{1,64})#(\d{1,7})$/.exec(part);
    if (!match?.[1] || !match[2]) return null;
    path.push({ id: match[1], index: Number(match[2]) });
  }
  return { path, id };
}

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

/** Where a walk starts when it begins inside loops (a subtree rendered on its own). */
export interface LoopStart {
  path: LoopStep[];
  frames: LoopFrame[];
}

const TOP: LoopStart = { path: [], frames: [] };

/**
 * The loop runs that can happen now, outer loops first: every loop whose enclosing loops have
 * rows. A loop below one without rows yet waits for them. At most `max` runs are listed. Rows may
 * be a sparse list (a later page of a loop): missing positions are skipped.
 */
export function loopInstances(
  root: ElementNode,
  rows: LoopRows,
  max = 200,
  start: LoopStart = TOP
): LoopInstance[] {
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
      const innerFrames = [loopFrame(node, item, index), ...frames];
      for (const child of node.children) visit(child, innerPath, innerFrames);
    });
  };
  visit(root, start.path, start.frames);
  return out.slice(0, max);
}

/** Runs one loop with its templates filled from the given fill function. */
export type LoopRunner = (
  instance: LoopInstance,
  fill: (template: string) => string
) => Promise<QueryRows>;

const NO_ROWS: QueryRows = { rows: [], hasMore: false, failed: true };

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
  max = 200,
  start: LoopStart = TOP,
  /** Rows already known (they are not run again). */
  seed: LoopRows = {},
  /**
   * The scope query settings are filled from (they are sent to a connector, never to the page):
   * the server passes one with the user's token. Other Loops build page rows, so they always use
   * `scope`.
   */
  fillScope: Readonly<Record<string, unknown>> = scope
): Promise<Record<string, QueryRows>> {
  const rows: Record<string, QueryRows> = { ...seed };
  for (;;) {
    const pending = loopInstances(root, rows, max, start).filter((i) => !(i.key in rows));
    if (pending.length === 0) break;
    const results = await Promise.all(
      pending.map((instance) => {
        const inner = withLoopScope(scope, instance.frames);
        // Other Loops read the page's own values: no request, so no runner.
        if (instance.query.source === "local")
          return Promise.resolve(localLoopRows(instance.query.local, inner));
        return run(instance, fillWith(withLoopScope(fillScope, instance.frames))).catch(
          () => NO_ROWS
        );
      })
    );
    pending.forEach((instance, at) => {
      rows[instance.key] = results[at] ?? NO_ROWS;
    });
  }
  return rows;
}
