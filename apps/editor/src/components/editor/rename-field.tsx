"use client";

import type { ElementNode } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "./store/editor-store";

/**
 * Inline name editor for an element. The name is how action flows and queries find the element, so
 * it is saved on Enter or blur when it is not empty. Names need not be unique. Escape drops
 * the edit.
 */
export function RenameField({
  node,
  fallback,
  className,
  autoFocus,
  onDone
}: {
  node: ElementNode;
  /** The name shown while the element has no name of its own (its type label). */
  fallback: string;
  className?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const rename = useEditorStore((s) => s.renameElement);
  const current = node.name ?? fallback;
  const [draft, setDraft] = useState(current);
  const ref = useRef<HTMLInputElement>(null);
  const invalid = draft.trim() === "";

  useEffect(() => setDraft(current), [current]);
  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [autoFocus]);

  function commit() {
    if (draft.trim() === current) return onDone?.();
    if (invalid) {
      setDraft(current);
      return onDone?.();
    }
    rename(node.id, draft);
    onDone?.();
  }

  return (
    <div className="min-w-0 flex-1">
      <input
        ref={ref}
        aria-label="Element name"
        aria-invalid={invalid}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(current);
            onDone?.();
          }
          e.stopPropagation();
        }}
        className={
          (className ?? "") +
          " w-full bg-transparent outline-none focus-visible:underline " +
          (invalid ? "text-danger" : "")
        }
      />
    </div>
  );
}
