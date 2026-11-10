"use client";

import { buildDynamicContext, type DynamicContext } from "@nextomic/schema";
import { useMemo } from "react";
import { useNextomicUser } from "./nextomic-user-store";
import { useEditorStore } from "./store/editor-store";

const SAMPLE_TOAST = {
  title: "Changes saved",
  message: "Your changes are saved and visible to everyone.",
  type: "success"
};

/**
 * The dynamic data context of the page or template being edited (what {{tags}} resolve to on the
 * canvas). Shared by the canvas and the expression autocomplete so both see the same values.
 */
export function useEditorDynamicContext(): DynamicContext | null {
  const doc = useEditorStore((s) => s.doc);
  const appState = useEditorStore((s) => s.project.appState);
  const constants = useEditorStore((s) => s.project.constants);
  const appAuth = useEditorStore((s) => s.project.appAuth);
  const nextomicUser = useNextomicUser((s) => s.user);
  const isToast = useEditorStore((s) => s.page?.templateType === "toast");
  return useMemo(
    () =>
      doc
        ? buildDynamicContext({
            page: { name: doc.name, route: doc.route, settings: doc.settings },
            tree: doc.tree,
            mode: "editor",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            globals: { appState, constants, appAuth },
            nextomicUser,
            // A toast template shows sample values while it is edited.
            toast: isToast ? SAMPLE_TOAST : null
          })
        : null,
    [doc, appState, constants, appAuth, nextomicUser, isToast]
  );
}
