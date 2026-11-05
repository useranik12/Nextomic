"use client";

import { ElementPanel, useSelectedNode } from "./element-panel";
import { PageOptions } from "./page-options";

export function RightPanel() {
  const node = useSelectedNode();
  return (
    <aside aria-label="Settings" className="flex h-full min-h-0 flex-col">
      {node ? <ElementPanel key={node.id} node={node} /> : <PageOptions />}
    </aside>
  );
}
