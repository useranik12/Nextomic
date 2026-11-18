"use client";

import { styleMarkIndex, type ElementNode, type StyleMarkIndex } from "@nextomic/schema";
import { useMemo } from "react";
import { useEditorStore } from "../store/editor-store";

/**
 * The change-dot lookup of the selected element: its own styles against the classes applied to it
 * and the class being edited. Built once per edit, so every row and header reads it cheaply.
 */
export function useStyleMarks(node: ElementNode): {
  index: StyleMarkIndex;
  breakpoint: string;
  state: ReturnType<typeof useEditorStore.getState>["activeState"];
} {
  const classes = useEditorStore((s) => s.project.classes);
  const activeClass = useEditorStore((s) => s.activeClass);
  const breakpoint = useEditorStore((s) => s.activeBreakpointId);
  const state = useEditorStore((s) => s.activeState);
  const index = useMemo(
    () =>
      styleMarkIndex(
        node.styles,
        node.classIds.map((name) => classes[name]),
        activeClass ? classes[activeClass] : undefined
      ),
    [node.styles, node.classIds, classes, activeClass]
  );
  return { index, breakpoint, state };
}
