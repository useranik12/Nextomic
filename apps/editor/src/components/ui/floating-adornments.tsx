"use client";

import type { ReactNode } from "react";
import { Icon } from "@/lib/icons/Icon";
import { Hint } from "./hint";

/**
 * The small icon buttons of a bindable field (conditional value, dynamic data bolt, clear X). They
 * float over the field at the top right with their centre on the top border line, as siblings of
 * the input (never children of it). Put it inside a `relative` box that wraps only the field.
 */
export function FloatingAdornments({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute right-2 top-0 z-10 flex -translate-y-1/2 items-center gap-0.5 [&>*]:pointer-events-auto">
      {children}
    </div>
  );
}

export const ADORNMENT_BUTTON =
  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-focus";

/** The clear X: shown by the caller only while the field holds a value. */
export function ClearAdornment({ onClear, label }: { onClear: () => void; label?: string }) {
  return (
    <Hint content="Clear the value">
      <button
        type="button"
        data-field-clear
        aria-label={label ? `Clear ${label}` : "Clear value"}
        onClick={onClear}
        className={ADORNMENT_BUTTON + " text-subtle hover:bg-default-hover hover:text-foreground"}
      >
        <Icon name="ph:x" width={14} height={14} />
      </button>
    </Hint>
  );
}
