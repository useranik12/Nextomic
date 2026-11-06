"use client";

import {
  countFamilyInStyles,
  countFamilyInTree,
  mentionsFamily,
  type ProjectFont
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fontUsageAction } from "@/app/(builder)/editor/[id]/font-actions";
import { useEditorStore } from "../../store/editor-store";

export interface FontUse {
  /** Names of variables whose value (or a theme override of it) names the family. */
  variables: string[];
  classes: number;
  elements: number;
  total: number;
}

/** Where each font's family is named: variables, themes, classes, and elements on every page. */
export function useFontUsage(fonts: readonly ProjectFont[]): {
  uses: Record<string, FontUse>;
  reload: () => Promise<void>;
} {
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const classes = useEditorStore((s) => s.project.classes);
  const variables = useEditorStore((s) => s.project.variables);
  const themes = useEditorStore((s) => s.project.themes);
  const pageId = useEditorStore((s) => s.page?.id);
  const [others, setOthers] = useState<Record<string, number>>({});
  const key = fonts.map((f) => f.family).join("|");

  const reload = useCallback(async () => {
    if (!pageId || key === "") return setOthers({});
    const result = await fontUsageAction(
      useEditorStore.getState().projectId,
      pageId,
      key.split("|")
    );
    if (result.error === null) setOthers(result.data);
  }, [pageId, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const uses = useMemo(() => {
    const out: Record<string, FontUse> = {};
    for (const family of key === "" ? [] : key.split("|")) {
      const names = new Set<string>();
      for (const v of variables) if (mentionsFamily(v.value, family)) names.add(v.name);
      for (const theme of themes)
        for (const [name, byMode] of Object.entries(theme.variables))
          if (Object.values(byMode).some((value) => mentionsFamily(value, family))) names.add(name);
      const inClasses = Object.values(classes).reduce(
        (sum, styles) => sum + countFamilyInStyles(styles, family),
        0
      );
      const elements = (tree ? countFamilyInTree(tree, family) : 0) + (others[family] ?? 0);
      out[family] = {
        variables: [...names],
        classes: inClasses,
        elements,
        total: names.size + inClasses + elements
      };
    }
    return out;
  }, [key, variables, themes, classes, tree, others]);

  return { uses, reload };
}
