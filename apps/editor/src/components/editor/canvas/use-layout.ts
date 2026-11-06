"use client";

import {
  composeForEditor,
  resolveLayout,
  type ElementNode,
  type PublishedTemplate
} from "@nextomic/schema";
import { useCallback, useEffect, useState } from "react";
import { loadLayoutTemplatesAction } from "@/app/(builder)/editor/[id]/library-actions";
import { pageRuleContext } from "../rules/editor-context";
import { useEditorStore } from "../store/editor-store";

/**
 * Puts the header and footer that apply to the open page around a page tree, for the canvas. The templates are the
 * saved ones; they are reloaded when another page or template is opened, so a header edited and
 * saved shows up when you come back. Only pages get a header and footer; templates show alone.
 */
export function useLayoutComposer(): (tree: ElementNode) => ElementNode {
  const projectId = useEditorStore((s) => s.projectId);
  const kind = useEditorStore((s) => s.page?.kind);
  const pageId = useEditorStore((s) => s.page?.id);
  const name = useEditorStore((s) => s.doc?.name ?? "");
  const route = useEditorStore((s) => s.doc?.route ?? "/");
  const choice = useEditorStore((s) => s.doc?.settings);
  const [templates, setTemplates] = useState<PublishedTemplate[]>([]);

  useEffect(() => {
    if (kind === "template") return;
    let live = true;
    void loadLayoutTemplatesAction(projectId).then((result) => {
      if (live && result.error === null) setTemplates(result.data);
    });
    return () => {
      live = false;
    };
  }, [projectId, kind, pageId]);

  return useCallback(
    (tree: ElementNode) => {
      if (kind === "template" || !pageId) return tree;
      const layout = resolveLayout(
        templates.map((t) => ({ ...t })),
        { header: choice?.header ?? "auto", footer: choice?.footer ?? "auto" },
        pageRuleContext({ id: pageId, name, route })
      );
      return composeForEditor(tree, layout.header?.tree ?? null, layout.footer?.tree ?? null);
    },
    [templates, kind, pageId, name, route, choice?.header, choice?.footer]
  );
}
