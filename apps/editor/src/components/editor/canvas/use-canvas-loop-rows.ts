"use client";

import {
  collectLoopRows,
  expressionScope,
  queryTemplates,
  type DynamicContext,
  type ElementNode,
  type LoopRows,
  type QueryRows
} from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { runQueryAction } from "@/app/(builder)/editor/[id]/query-actions";

// Live rows for the query loops on the canvas (docs/dynamic-data-and-actions.md section 3). Each
// loop run fills its templates with the canvas preview values and asks the server, through the
// connector proxy, for its rows. Results stay in memory: a run with the same query and the same
// filled values is answered from the cache, so editing other things does not refetch.

/** Most loop runs the canvas makes (nested loops run once per outer row). */
const MAX_CANVAS_RUNS = 30;
const DEBOUNCE_MS = 400;
const CACHE_LIMIT = 300;

interface LoopPreviewState {
  /** Why a loop's preview failed, by element id. */
  errors: Readonly<Record<string, string>>;
  setErrors: (errors: Record<string, string>) => void;
}

/** Preview errors of the canvas query loops, read by the Query Loop panel. */
export const useLoopPreview = create<LoopPreviewState>((set) => ({
  errors: {},
  setErrors: (errors) => set({ errors })
}));

export function useCanvasLoopRows(
  projectId: string,
  tree: ElementNode | null,
  dynamic: DynamicContext | null
): LoopRows {
  const [rows, setRows] = useState<LoopRows>({});
  const cache = useRef(new Map<string, Promise<QueryRows>>());

  useEffect(() => {
    if (!tree || !dynamic || !projectId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const errors: Record<string, string> = {};
      const store = cache.current;
      if (store.size > CACHE_LIMIT) store.clear();
      void collectLoopRows(
        tree,
        expressionScope(dynamic),
        async (instance, fill) => {
          const resolved = Object.fromEntries(
            queryTemplates(instance.query).map((template) => [template, fill(template)])
          );
          const key = JSON.stringify([projectId, instance.query, resolved]);
          let pending = store.get(key);
          if (!pending) {
            pending = runQueryAction(projectId, { query: instance.query, resolved }).then(
              (result) => {
                if (result.error !== null) throw new Error(result.error);
                return result.data;
              }
            );
            store.set(key, pending);
            // A failed run is asked again next time (the source may have been fixed).
            pending.catch(() => store.delete(key));
          }
          try {
            return await pending;
          } catch (error) {
            errors[instance.node.id] =
              error instanceof Error ? error.message : "The query could not run.";
            throw error;
          }
        },
        MAX_CANVAS_RUNS
      ).then((next) => {
        if (cancelled) return;
        setRows(next);
        useLoopPreview.getState().setErrors(errors);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [projectId, tree, dynamic]);

  return rows;
}
