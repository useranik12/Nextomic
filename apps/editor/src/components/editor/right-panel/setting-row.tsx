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
  layout = "stacked",
  responsive,
  children
}: {
  label: string;
  htmlFor?: string;
  changed?: boolean;
  onReset?: () => void;
  /** `inline` puts the control to the right of the label (inputs); `stacked` puts it below. */
  layout?: "stacked" | "inline";
  /** Shows the small device icon: the value can differ per breakpoint. */
  responsive?: boolean;
  children: ReactNode;
}) {
  const inline = layout === "inline";
  return (
    <div
      className={inline ? "flex items-center gap-2" : "flex flex-col gap-1.5"}
      onContextMenu={
        changed && onReset
          ? (event) => {
              event.preventDefault();
              onReset();
            }
          : undefined
      }
    >
      <div
        className={
          "relative flex min-h-6 items-center gap-1.5 " + (inline ? "w-[42%] shrink-0" : "")
        }
      >
        {changed ? (
          <span
            role="img"
            aria-label="Changed at this breakpoint"
            className="absolute -left-2.5 h-1.5 w-1.5 rounded-full bg-warning"
          />
        ) : null}
        <label htmlFor={htmlFor} className="truncate text-small font-semibold text-foreground">
          {label}
        </label>
        {responsive ? (
          <Icon name="ph:laptop" width={12} height={12} className="shrink-0 text-default-500" />
        ) : null}
        {changed && onReset ? (
          <button
            type="button"
            aria-label={`Reset ${label}`}
            title="Reset (or right-click the row)"
            onClick={onReset}
            className="ml-auto rounded p-0.5 text-default-500 hover:text-foreground"
          >
            <Icon name="ph:arrow-counter-clockwise" width={12} height={12} />
          </button>
        ) : null}
      </div>
      <div className={inline ? "min-w-0 flex-1" : ""}>{children}</div>
    </div>
  );
}

export const compactFieldClass =
  "h-8 w-full rounded-full border-2 border-default-200 bg-transparent px-3 text-small text-foreground outline-none transition-colors placeholder:text-default-400 hover:border-default-400 focus:border-default-800 focus:ring-2 focus:ring-default-800/10";

/** Square field used in the Design tab; sits flush against a tile button when joined. */
export const designFieldClass =
  "h-9 w-full min-w-0 bg-default-100 px-3 text-small text-foreground outline-none transition-colors placeholder:text-default-400 hover:bg-default-200 focus:bg-default-200 focus-visible:ring-2 focus-visible:ring-default-800/30";
