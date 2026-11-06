"use client";

import { ElementPanel, useSelectedNode } from "./element-panel";
import { PageOptions } from "./page-options";
import { TemplateOptions } from "./template-options";
import { useEditorStore } from "../store/editor-store";

export function RightPanel() {
  const node = useSelectedNode();
  const isTemplate = useEditorStore((s) => s.page?.kind === "template");
  return (
    <aside aria-label="Settings" className="flex h-full min-h-0 flex-col">
      {node ? (
        <ElementPanel key={node.id} node={node} />
      ) : isTemplate ? (
        <TemplateOptions />
      ) : (
        <PageOptions />
      )}
    </aside>
  );
}
