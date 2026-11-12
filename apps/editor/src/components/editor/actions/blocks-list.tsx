"use client";

import { useEffect, useState } from "react";
import { listBlocksAction } from "@/app/(builder)/editor/[id]/action-flow-actions";
import type { StoredBlock } from "@/server/action-flows";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { useFlowStore } from "./flow-store";

type Load =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; blocks: StoredBlock[] };

/** The Action Blocks tab: the project's reusable flows. */
export function BlocksList() {
  const projectId = useEditorStore((s) => s.projectId);
  // Reloaded whenever the block editor closes, so saved changes show.
  const editing = useFlowStore((s) => s.blockEditor);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!projectId || editing) return;
    let live = true;
    setLoad({ status: "loading" });
    void listBlocksAction(projectId).then((result) => {
      if (!live) return;
      setLoad(
        result.error !== null
          ? { status: "error", error: result.error }
          : { status: "ready", blocks: result.data }
      );
    });
    return () => {
      live = false;
    };
  }, [projectId, editing, attempt]);

  const open = (id: string | null) => useFlowStore.getState().openBlock(id ?? "new");

  if (load.status === "loading") {
    return <p className="text-sm text-muted">Loading Action Blocks…</p>;
  }
  if (load.status === "error") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-danger">{load.error}</p>
        <ActionButton size="sm" tone="ghost" onPress={() => setAttempt((n) => n + 1)}>
          Try again
        </ActionButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {load.blocks.length === 0 ? (
        <p className="text-sm text-muted">
          Action Blocks are flows you reuse across the project. Editing one changes every use.
        </p>
      ) : (
        <ul aria-label="Action Blocks" className="flex flex-col gap-2">
          {load.blocks.map(({ block }) => (
            <li key={block.id}>
              <button
                type="button"
                onClick={() => open(block.id)}
                className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition-colors duration-300 hover:border-default-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="truncate text-base font-semibold text-foreground">
                  {block.name}
                </span>
                <span className="text-xs text-muted">
                  {block.params.length} {block.params.length === 1 ? "parameter" : "parameters"}
                  {block.returns ? " · returns a value" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ActionButton size="sm" startContent={<Icon name="ph:plus" />} onPress={() => open(null)}>
        Add action block
      </ActionButton>
    </div>
  );
}
