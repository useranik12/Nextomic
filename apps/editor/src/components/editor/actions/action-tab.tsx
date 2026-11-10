"use client";

import type { ElementNode } from "@nextomic/schema";
import { useState } from "react";
import { ActionsList } from "./actions-list";
import { BlocksList } from "./blocks-list";

const TABS = [
  { id: "actions", label: "Actions" },
  { id: "blocks", label: "Action Blocks" }
] as const;

/** The element panel's Action tab: the element's flows, and the project's Action Blocks. */
export function ActionTab({ node }: { node: ElementNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("actions");
  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Action settings"
        className="flex gap-1 rounded-medium bg-default-100 p-1"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              "h-8 flex-1 rounded-small px-2 text-small font-medium transition-colors duration-300 " +
              (tab === id
                ? "bg-default-300 text-foreground"
                : "text-default-500 hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "actions" ? <ActionsList node={node} /> : <BlocksList />}</div>
    </div>
  );
}
