"use client";

import { countRefsInStyles, countVariableUsageInTree } from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { variableUsageAction } from "@/app/(builder)/editor/[id]/actions";
import { useEditorStore } from "../store/editor-store";

/** References per variable: the open page and class styles live, the other saved pages from the server. */
export function useVariableUsage(): { usage: Record<string, number>; reload: () => Promise<void> } {
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const classes = useEditorStore((s) => s.project.classes);
  const pageId = useEditorStore((s) => s.page?.id);
  const [others, setOthers] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    if (!pageId) return;
    const result = await variableUsageAction(useEditorStore.getState().projectId, pageId);
    if (result.error === null) setOthers(result.data);
  }, [pageId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const usage = useMemo(() => {
    const counts: Record<string, number> = { ...others };
    if (tree) countVariableUsageInTree(tree, counts);
    for (const styles of Object.values(classes)) countRefsInStyles(styles, counts);
    return counts;
  }, [others, tree, classes]);

  return { usage, reload };
}
