"use client";

import { expressionScope, loopAncestors, loopFrame, withLoopScope } from "@nextomic/schema";
import { useMemo } from "react";
import { useEditorStore } from "../store/editor-store";
import { useEditorDynamicContext } from "../use-editor-context";

/**
 * The expression scope for fields of the selected element: the page's preview values plus the
 * query loops around the element as `%name`. Loop rows are fetched live on the canvas, so the row
 * here is empty: tags check and complete by shape, not by row values.
 */
export function useExpressionScope(): Record<string, unknown> | null {
  const context = useEditorDynamicContext();
  const tree = useEditorStore((s) => s.doc?.tree);
  const selectedId = useEditorStore((s) => s.selectedId);
  return useMemo(() => {
    if (!context) return null;
    const loops = tree && selectedId ? loopAncestors(tree, selectedId) : [];
    return withLoopScope(
      expressionScope(context),
      loops.map((node) => loopFrame(node, {}, 0))
    );
  }, [context, tree, selectedId]);
}
