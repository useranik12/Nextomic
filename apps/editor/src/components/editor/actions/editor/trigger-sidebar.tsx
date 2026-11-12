"use client";

import { countEnabledActions, getTrigger, triggerLabel } from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useFlowDraft } from "./flow-draft";
import { TriggerPicker } from "./trigger-picker";

/** Left column: search, add, and the element's triggers with action counts. */
export function TriggerSidebar() {
  const target = useFlowDraft((s) => s.target);
  const flows = useFlowDraft((s) => s.flows);
  const current = useFlowDraft((s) => s.trigger);
  const [query, setQuery] = useState("");
  if (target?.mode !== "flows") return null;
  const q = query.trim().toLowerCase();
  const rows = flows
    .map((flow) => {
      const def = getTrigger(flow.trigger);
      return { flow, label: def ? triggerLabel(def, target.owner) : flow.trigger };
    })
    .filter((row) => !q || row.label.toLowerCase().includes(q));

  const remove = (trigger: string) => {
    const draft = useFlowDraft.getState();
    draft.setFlows(draft.flows.filter((f) => f.trigger !== trigger));
    if (draft.trigger === trigger) draft.selectTrigger(null);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-1">
        <input
          type="search"
          aria-label="Search triggers"
          placeholder="Search triggers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus:border-default-400"
        />
        <TriggerPicker variant="icon" />
      </div>
      {flows.length === 0 ? (
        <p className="text-sm text-muted">No triggers yet. Press + to add one.</p>
      ) : (
        <ul aria-label="Triggers" className="flex flex-col gap-1">
          {rows.map(({ flow, label }) => {
            const count = countEnabledActions(flow.nodes);
            return (
              <li
                key={flow.id}
                className={
                  "flex items-center gap-1 rounded-xl pr-1 transition-colors duration-300 " +
                  (flow.trigger === current ? "bg-default-hover" : "hover:bg-default")
                }
              >
                <button
                  type="button"
                  aria-current={flow.trigger === current}
                  onClick={() => useFlowDraft.getState().selectTrigger(flow.trigger)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm ${flow.disabled ? "text-subtle" : "text-foreground"}`}
                >
                  <span className="truncate">{label}</span>
                  <span className="rounded-full bg-default px-2 text-xs text-body">{count}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${label}`}
                  onClick={() => remove(flow.trigger)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-default hover:text-danger"
                >
                  <Icon name="ph:trash" width={14} height={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
