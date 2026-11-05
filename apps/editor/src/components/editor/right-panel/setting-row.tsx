"use client";

import type { ReactNode } from "react";
import { Icon } from "@/lib/icons/Icon";

/**
 * One settings row: a yellow dot before the label when the value is set at the current
 * breakpoint and state, and a reset icon that clears it.
 */
export function SettingRow({
  label,
  htmlFor,
  changed,
  onReset,
  children
}: {
  label: string;
  htmlFor?: string;
  changed?: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-4 items-center gap-1.5">
        {changed ? (
          <span
            role="img"
            aria-label="Changed at this breakpoint"
            className="h-1.5 w-1.5 rounded-full bg-warning"
          />
        ) : null}
        <label htmlFor={htmlFor} className="text-tiny font-medium text-default-600">
          {label}
        </label>
        {changed && onReset ? (
          <button
            type="button"
            aria-label={`Reset ${label}`}
            onClick={onReset}
            className="ml-auto rounded p-0.5 text-default-500 hover:text-foreground"
          >
            <Icon name="ph:arrow-counter-clockwise" width={12} height={12} />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export const compactFieldClass =
  "h-8 w-full rounded-full border-2 border-default-200 bg-transparent px-3 text-small text-foreground outline-none transition-colors placeholder:text-default-400 hover:border-default-400 focus:border-default-800 focus:ring-2 focus:ring-default-800/10";
