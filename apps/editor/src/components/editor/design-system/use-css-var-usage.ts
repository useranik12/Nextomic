"use client";

import { useMemo } from "react";
import { useEditorStore } from "../store/editor-store";

const escape = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How often `var(--name)` appears in the open page and in class styles. Other saved pages are not
 * scanned, so a count of zero means "not used here".
 */
export function useCssVarUsage(): (name: string) => number {
  const classes = useEditorStore((s) => s.project.classes);
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const text = useMemo(() => JSON.stringify(classes) + JSON.stringify(tree), [classes, tree]);
  return useMemo(() => {
    const cache = new Map<string, number>();
    return (name: string): number => {
      const hit = cache.get(name);
      if (hit !== undefined) return hit;
      const count =
        text.match(new RegExp(String.raw`var\(\s*--${escape(name)}(?![\w-])`, "g"))?.length ?? 0;
      cache.set(name, count);
      return count;
    };
  }, [text]);
}
