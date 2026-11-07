"use client";

import { buildDynamicContext, type DynamicContext } from "@nextomic/schema";
import { useMemo } from "react";
import { useEditorStore } from "./store/editor-store";

/**
 * The dynamic data context of the page or template being edited (what {{tags}} resolve to on the
 * canvas). Shared by the canvas and the expression autocomplete so both see the same values.
 */
export function useEditorDynamicContext(): DynamicContext | null {
  const doc = useEditorStore((s) => s.doc);
  const appState = useEditorStore((s) => s.project.appState);
  const constants = useEditorStore((s) => s.project.constants);
  return useMemo(
    () =>
      doc
        ? buildDynamicContext({
            page: { name: doc.name, route: doc.route, settings: doc.settings },
            tree: doc.tree,
            mode: "editor",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            globals: { appState, constants }
          })
        : null,
    [doc, appState, constants]
  );
}
