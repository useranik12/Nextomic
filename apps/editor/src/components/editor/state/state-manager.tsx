"use client";

import type { StateGroup } from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { StateTable } from "./state-table";
import { useStateUsage } from "./use-state-usage";

const TABS: { id: StateGroup; label: string }[] = [
  { id: "app", label: "App State" },
  { id: "const", label: "Constants" }
];

/**
 * State Management (docs/ui-reference.md 4.10): App State (global values actions can change) and
 * Constants (fixed values). Opens from the left rail as a full page; the canvas is hidden meanwhile.
 */
export function StateManager() {
  const [tab, setTab] = useState<StateGroup>("app");
  const usage = useStateUsage();
  const appCount = useEditorStore((s) => s.project.appState.length);
  const constCount = useEditorStore((s) => s.project.constants.length);
  const counts: Record<StateGroup, number> = { app: appCount, const: constCount };
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">State Management</h1>
          <p className="text-small text-default-500">
            Values every page and template can read with the bolt icon: write{" "}
            <code className="text-default-700">{"{{app.name}}"}</code> for app state and{" "}
            <code className="text-default-700">{"{{const.name}}"}</code> for constants. Page state
            lives in the page settings panel.
          </p>
        </header>
        <div role="tablist" aria-label="State" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`state-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`state-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-small transition-colors duration-300 " +
                (tab === t.id
                  ? "bg-default-200 font-medium text-foreground"
                  : "text-default-600 hover:bg-default-100")
              }
            >
              {t.label}
              <span className="rounded-full bg-default-100 px-1.5 text-tiny text-default-600">
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-start gap-2 rounded-large border border-warning/40 bg-warning/10 p-3 text-small text-default-700">
          <Icon name="ph:warning" width={16} height={16} className="mt-0.5 shrink-0 text-warning" />
          <p>
            {tab === "app"
              ? "Persisted values live in the visitor's browser and visitors can change them. Never store passwords, tokens or other secrets here, and never use them to decide what a visitor may see or do."
              : "Constants are written into the built site and anyone can read them. Never put API keys, passwords or other secrets here; use connector secrets instead."}
          </p>
        </div>
        <section
          role="tabpanel"
          id={`state-panel-${tab}`}
          aria-labelledby={`state-tab-${tab}`}
          className="rounded-large border border-divider bg-content1/30 p-5"
        >
          <StateTable key={tab} group={tab} usage={usage} />
        </section>
      </div>
    </div>
  );
}
