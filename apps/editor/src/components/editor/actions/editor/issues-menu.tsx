"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTrigger, triggerLabel } from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useFlowDraft } from "./flow-draft";
import type { EditorIssue } from "./use-flow-editor";

/** Header badge with the draft's problems; picking one opens its trigger and node. */
export function IssuesMenu({ issues }: { issues: readonly EditorIssue[] }) {
  const owner = useFlowDraft((s) => (s.target?.mode === "flows" ? s.target.owner : null));
  const [open, setOpen] = useState(false);
  if (issues.length === 0) {
    return <span className="text-xs text-success">No issues</span>;
  }
  const errors = issues.filter((i) => i.severity === "error").length;

  const jump = (issue: EditorIssue) => {
    const draft = useFlowDraft.getState();
    if (issue.trigger) draft.selectTrigger(issue.trigger);
    draft.select(issue.nodeId);
    setOpen(false);
  };

  return (
    <Popover placement="bottom-end" isOpen={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium ${errors > 0 ? "bg-danger-50 text-danger" : "bg-warning-50 text-warning"}`}
        >
          <Icon name="ph:warning" width={14} height={14} />
          {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[50vh] w-80 overflow-y-auto p-1">
        <ul aria-label="Issues" className="flex w-full flex-col">
          {issues.map((issue, i) => {
            const def = issue.trigger ? getTrigger(issue.trigger) : undefined;
            return (
              <li key={`${issue.trigger}-${issue.nodeId}-${i}`}>
                <button
                  type="button"
                  onClick={() => jump(issue)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-default"
                >
                  <span
                    className={`text-sm ${issue.severity === "error" ? "text-danger" : "text-warning"}`}
                  >
                    {issue.message}
                  </span>
                  {def && owner ? (
                    <span className="text-xs text-muted">{triggerLabel(def, owner)}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
