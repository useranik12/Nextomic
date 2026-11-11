"use client";

import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui-v2/react";
import { Modal } from "@/components/ui/legacy-modal";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";

// Edits in a form are a draft until Save. While a draft has changes, a click anywhere else in the
// editor is held back and a dialog asks to save, discard or keep editing, so nothing is lost or
// moved away from by accident. Pop-ups (selects, menus, dialogs) live outside the editor root and
// are not held back.

let guarded = 0;

/** While any draft is guarded, the canvas iframe must not take clicks that skip the guard. */
function setIframeGuard(on: boolean) {
  guarded += on ? 1 : -1;
  document.documentElement.toggleAttribute("data-draft-guard", guarded > 0);
}

export function DraftScope({
  label,
  dirty,
  onSave,
  onDiscard,
  className,
  children
}: {
  /** What is being edited, for the dialog ("App State", "Page Parameters"). */
  label: string;
  dirty: boolean;
  /** Saves the draft; returns false when it could not be saved (the form shows why). */
  onSave: () => boolean | Promise<boolean>;
  onDiscard: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    let held = false;
    const outside = (target: EventTarget | null) =>
      target instanceof Node &&
      !ref.current?.contains(target) &&
      target instanceof Element &&
      target.closest("[data-editor-root]") !== null;
    const onDown = (e: PointerEvent) => {
      if (!outside(e.target)) return;
      held = true;
      e.preventDefault();
      e.stopPropagation();
      setAsking(true);
    };
    const onClick = (e: MouseEvent) => {
      if (!held) return;
      held = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    setIframeGuard(true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
      setIframeGuard(false);
    };
  }, [dirty]);

  return (
    <div ref={ref} data-draft-scope={label} className={className}>
      {children}
      {asking ? (
        <Modal isOpen onClose={() => setAsking(false)} backdrop="blur" size="sm">
          <ModalContent>
            <ModalHeader className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warning" />
              Unsaved changes
            </ModalHeader>
            <ModalBody>
              <p className="text-small text-default-600">
                Your changes to {label} are not saved yet. Save them, discard them, or keep editing.
              </p>
            </ModalBody>
            <ModalFooter>
              <ActionButton tone="ghost" onPress={() => setAsking(false)}>
                Keep editing
              </ActionButton>
              <ActionButton
                tone="danger-ghost"
                onPress={() => {
                  setAsking(false);
                  onDiscard();
                }}
              >
                Discard
              </ActionButton>
              <ActionButton
                onPress={async () => {
                  setAsking(false);
                  await onSave();
                }}
              >
                Save
              </ActionButton>
            </ModalFooter>
          </ModalContent>
        </Modal>
      ) : null}
    </div>
  );
}

/** The small Discard and Save buttons of a draft, with a dot while there are changes. */
export function DraftActions({
  label,
  dirty,
  onSave,
  onDiscard
}: {
  label: string;
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {dirty ? (
        <span className="flex items-center gap-1.5 text-tiny text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Unsaved changes
        </span>
      ) : (
        <span className="flex items-center gap-1 text-tiny text-default-400">
          <Icon name="ph:check" width={12} height={12} />
          Saved
        </span>
      )}
      <ActionButton
        size="sm"
        tone="outline"
        aria-label={`Discard changes to ${label}`}
        isDisabled={!dirty}
        onPress={onDiscard}
        className="h-7 px-2.5"
      >
        Discard
      </ActionButton>
      <ActionButton
        size="sm"
        aria-label={`Save ${label}`}
        isDisabled={!dirty}
        onPress={onSave}
        className="h-7 px-3"
      >
        Save
      </ActionButton>
    </div>
  );
}
