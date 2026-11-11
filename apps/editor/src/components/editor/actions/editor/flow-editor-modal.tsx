"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { BlockSidebar } from "./block-sidebar";
import { DefinePanel } from "./define-panel";
import { FlowCanvas } from "./flow-canvas";
import { useFlowDraft } from "./flow-draft";
import { useFlowTest } from "./flow-test";
import { IssuesMenu } from "./issues-menu";
import { TestPanel } from "./test-panel";
import { TriggerSidebar } from "./trigger-sidebar";
import { useFlowEditor } from "./use-flow-editor";

/** Text fields keep their own undo; the flow's undo works everywhere else. */
function onHistoryKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const el = e.target as HTMLElement;
  if (el.closest("input, textarea, [contenteditable='true']")) return;
  const key = e.key.toLowerCase();
  const draft = useFlowDraft.getState();
  if (key === "z" && !e.shiftKey) draft.undo();
  else if ((key === "z" && e.shiftKey) || key === "y") draft.redo();
  else return;
  e.preventDefault();
}

function UnsavedDialog({
  onKeep,
  onDiscard,
  onSave
}: {
  onKeep: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen onClose={onKeep} backdrop="blur" size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-warning" />
          Unsaved changes
        </ModalHeader>
        <ModalBody>
          <p className="text-small text-default-600">
            Your actions are not saved yet. Save them, discard them, or keep editing.
          </p>
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onKeep}>
            Keep editing
          </ActionButton>
          <ActionButton tone="danger-ghost" onPress={onDiscard}>
            Discard
          </ActionButton>
          <ActionButton onPress={onSave}>Save</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** The Action Flow Editor: triggers (or block settings), the flow, and the selected node's settings. */
export function FlowEditorModal() {
  const { load, issues, save, saving, close } = useFlowEditor();
  const target = useFlowDraft((s) => s.target);
  const dirty = useFlowDraft((s) => s.dirty);
  const trigger = useFlowDraft((s) => s.trigger);
  const hasNodes = useFlowDraft((s) => s.nodes().length > 0);
  const testing = useFlowTest((s) => s.active);
  const startTest = useFlowTest((s) => s.start);
  const [asking, setAsking] = useState(false);
  const errors = useMemo(
    () =>
      new Set(
        issues
          .filter(
            (i) =>
              i.severity === "error" &&
              i.nodeId &&
              (target?.mode === "block" || i.trigger === trigger)
          )
          .map((i) => i.nodeId as string)
      ),
    [issues, target, trigger]
  );
  if (load.status === "closed") return null;
  // While a test runs the editor steps aside so the canvas shows what the flow does.
  if (testing) return <TestPanel />;
  const testBlocked =
    target?.mode !== "flows"
      ? "Test a block from a flow that calls it."
      : !trigger || !hasNodes
        ? "Add an action to this trigger to test it."
        : null;

  const requestClose = () => (dirty ? setAsking(true) : close());
  const subtitle =
    target?.mode === "flows" ? target.elementName : target?.mode === "block" ? "Action Block" : "";

  return (
    <Modal
      isOpen
      onClose={requestClose}
      isDismissable={false}
      hideCloseButton
      size="full"
      // Same 16px gap on every side; "full" alone fills the screen top to bottom.
      classNames={{
        wrapper: "items-center",
        base: "!m-4 h-[calc(100dvh-2rem)] min-h-0 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none !rounded-large",
        body: "p-0"
      }}
    >
      <ModalContent>
        <div className="flex h-full min-h-0 flex-col" onKeyDown={onHistoryKey}>
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider px-4">
            <h2 className="flex min-w-0 items-center gap-2 text-medium font-medium">
              <Icon name="ph:lightning" width={20} height={20} />
              Action Flow Editor
              {subtitle ? (
                <span className="truncate text-small font-normal text-default-500">{subtitle}</span>
              ) : null}
            </h2>
            <div className="flex items-center gap-2">
              {load.status === "ready" ? <IssuesMenu issues={issues} /> : null}
              {dirty ? (
                <span className="text-tiny font-medium text-warning">Unsaved changes</span>
              ) : null}
              <span
                title={testBlocked ?? "Run this trigger on the canvas with the unsaved changes."}
              >
                <ActionButton
                  size="sm"
                  tone="ghost"
                  isDisabled={testBlocked !== null || load.status !== "ready"}
                  startContent={<Icon name="ph:play" />}
                  onPress={() => void startTest()}
                >
                  Test
                </ActionButton>
              </span>
              <ActionButton
                size="sm"
                isDisabled={!dirty || load.status !== "ready"}
                isLoading={saving}
                onPress={() => void save()}
              >
                Save
              </ActionButton>
              <button
                type="button"
                aria-label="Close the Action Flow Editor"
                onClick={requestClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors duration-300 hover:bg-default-100"
              >
                <Icon name="ph:x" width={16} height={16} />
              </button>
            </div>
          </header>
          {load.status === "loading" ? (
            <p className="p-6 text-small text-default-500">Loading the flow editor…</p>
          ) : load.status === "error" ? (
            <p role="alert" className="p-6 text-small text-danger">
              {load.error}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <aside
                aria-label={target?.mode === "block" ? "Block settings" : "Triggers"}
                className="w-64 shrink-0 overflow-y-auto border-r border-divider p-3"
              >
                {target?.mode === "block" ? <BlockSidebar /> : <TriggerSidebar />}
              </aside>
              <main className="min-w-0 flex-1 overflow-hidden bg-default-50/50">
                <FlowCanvas errors={errors} />
              </main>
              <aside
                aria-label="Settings"
                className="w-80 shrink-0 overflow-y-auto border-l border-divider p-3"
              >
                <DefinePanel />
              </aside>
            </div>
          )}
        </div>
        {asking ? (
          <UnsavedDialog
            onKeep={() => setAsking(false)}
            onDiscard={() => {
              setAsking(false);
              close();
            }}
            onSave={async () => {
              setAsking(false);
              if (await save()) close();
            }}
          />
        ) : null}
      </ModalContent>
    </Modal>
  );
}
