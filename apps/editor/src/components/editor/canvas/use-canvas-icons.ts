"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawIconsAction } from "@/app/(builder)/editor/[id]/icon-actions";
import { useEditorStore } from "../store/editor-store";
import { iconKey, type CanvasIconRef, type CanvasIcons } from "./protocol";

// Icons on the canvas. The canvas finds out which icons it needs while it renders (a name may come
// from a loop row) and reports them here; they are drawn on the server from the project's
// libraries, kept in memory, and sent back with the next render. Only drawn icons cross the wire,
// never a whole set. Libraries are the draft ones, so a set installed but not yet saved shows.

const EMPTY: CanvasIcons = { svg: {}, fonts: {}, css: "" };
const BATCH_MS = 40;

export function useCanvasIcons(projectId: string) {
  const libraries = useEditorStore((s) => s.project.iconLibraries);
  const [icons, setIcons] = useState<CanvasIcons>(EMPTY);
  const pending = useRef<Map<string, CanvasIconRef>>(new Map());
  const asked = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const known = useRef(EMPTY);
  known.current = icons;
  // Anything drawn from a library that changed (installed, updated, removed) is drawn again.
  const signature = libraries
    .map((l) => `${l.key}:${l.sha256}:${l.mode}:${l.enabled}`)
    .sort()
    .join("|");
  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;

  useEffect(() => {
    asked.current = new Set();
    pending.current = new Map();
    setIcons(EMPTY);
  }, [signature, projectId]);

  const flush = useCallback(async () => {
    timer.current = null;
    const refs = [...pending.current.values()].slice(0, 300);
    pending.current = new Map([...pending.current].slice(300));
    if (refs.length === 0) return;
    const res = await drawIconsAction(projectId, librariesRef.current, refs);
    setIcons((current) => {
      // A failed request draws nothing for these icons and is not repeated until libraries change.
      const data = res.error === null ? res.data : { svg: {}, fonts: {}, css: "" };
      const svg = { ...current.svg, ...data.svg };
      for (const ref of refs) svg[iconKey(ref)] ??= null;
      return {
        svg,
        fonts: { ...current.fonts, ...data.fonts },
        css: current.css + data.css
      };
    });
    if (pending.current.size > 0) void flush();
  }, [projectId]);

  const request = useCallback(
    (refs: readonly CanvasIconRef[]) => {
      for (const ref of refs) {
        const key = iconKey(ref);
        if (asked.current.has(key) || key in known.current.svg) continue;
        asked.current.add(key);
        pending.current.set(key, ref);
      }
      if (pending.current.size > 0 && !timer.current)
        timer.current = setTimeout(() => void flush(), BATCH_MS);
    },
    [flush]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { icons, request };
}
