"use client";

import { Spinner } from "@heroui/react";

/** A spinner with a visible quiet label, for a section that is loading or a call that is running. */
export function Busy({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center gap-2 text-xs text-muted ${className ?? ""}`}>
      <Spinner size="sm" color="current" />
      <span>{label}…</span>
    </div>
  );
}
