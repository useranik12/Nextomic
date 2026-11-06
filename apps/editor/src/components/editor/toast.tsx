"use client";

import { useEffect } from "react";
import { useEditorStore } from "./store/editor-store";

const SHOW_MS = 2200;

/** A small, quiet message at the bottom of the editor; it goes away by itself. */
export function Toast() {
  const toast = useEditorStore((s) => s.toast);
  const dismiss = useEditorStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center"
    >
      {toast ? (
        <p
          key={toast.id}
          className="max-w-[80vw] truncate rounded-full border border-divider bg-content1 px-4 py-2 text-small text-foreground shadow-lg"
        >
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}
