"use client";

import type { RunLogEntry } from "@nextomic/runtime";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useFlowTest, type TestStatus } from "./flow-test";

// Floats over the canvas while a flow editor Test runs: each step with its status, time and
// output or error, then Run again or Back to the editor (which drops the test's state).

const STATUS_TEXT: Record<TestStatus, string> = {
  idle: "",
  preparing: "Preparing…",
  running: "Running…",
  done: "Finished"
};

function outputText(value: unknown): string {
  if (value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

function Step({ entry }: { entry: RunLogEntry }) {
  const ok = entry.status === "ok";
  const detail = ok ? outputText(entry.output) : (entry.error ?? "");
  return (
    <li className="flex gap-2 py-1.5">
      <Icon
        name={ok ? "ph:check-circle" : "ph:x-circle"}
        width={16}
        height={16}
        className={ok ? "mt-0.5 shrink-0 text-success" : "mt-0.5 shrink-0 text-danger"}
        aria-label={ok ? "Done" : "Failed"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm">{entry.label}</span>
          <span className="shrink-0 text-xs text-muted">{entry.ms} ms</span>
        </div>
        {detail ? (
          <p className={`break-words font-mono text-xs ${ok ? "text-muted" : "text-danger"}`}>
            {detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function TestPanel() {
  const active = useFlowTest((s) => s.active);
  const status = useFlowTest((s) => s.status);
  const scope = useFlowTest((s) => s.scope);
  const entries = useFlowTest((s) => s.entries);
  const error = useFlowTest((s) => s.error);
  const finish = useFlowTest((s) => s.finish);
  const again = useFlowTest((s) => s.again);
  if (!active) return null;
  const busy = status === "preparing" || status === "running";
  return (
    <section
      aria-label="Test run"
      className="fixed bottom-4 right-4 z-50 flex max-h-[60vh] w-96 flex-col rounded-2xl border border-border bg-surface shadow-lg"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Icon name="ph:play" width={16} height={16} />
          Test · {scope}
        </h2>
        <span role="status" className="text-xs text-muted">
          {STATUS_TEXT[status]}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {entries.length === 0 && !error ? (
          <p className="py-2 text-sm text-muted">
            {busy ? "Waiting for the first step…" : "No steps ran."}
          </p>
        ) : (
          <ol aria-label="Test steps" className="divide-y divide-border">
            {entries.map((entry, index) => (
              <Step key={`${entry.nodeId}-${index}`} entry={entry} />
            ))}
          </ol>
        )}
        {error ? (
          <p role="alert" className="py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-3 py-2">
        <ActionButton
          size="sm"
          tone="ghost"
          isDisabled={busy}
          startContent={<Icon name="ph:arrow-clockwise" />}
          onPress={() => void again()}
        >
          Run again
        </ActionButton>
        <ActionButton size="sm" onPress={finish}>
          Back to editor
        </ActionButton>
      </footer>
    </section>
  );
}
