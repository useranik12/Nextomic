"use client";

import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";

/**
 * One settings row. The label line comes first and may wrap: the label, the responsive icon, a tip
 * (opens to the left), any extra controls, and on the right the changed dot and the reset button.
 * The value fields sit on their own line below, so every field has the full panel width.
 */
export function SettingRow({
  label,
  htmlFor,
  changed,
  onReset,
  responsive,
  tip,
  actions,
  icon,
  children
}: {
  label: string;
  htmlFor?: string;
  changed?: boolean;
  onReset?: (() => void) | undefined;
  /** Shows the small device icon: the value can differ per breakpoint. */
  responsive?: boolean;
  /** Plain-words help, shown by an (i) beside the label. */
  tip?: string | undefined;
  /** Extra controls on the label line, such as the side link buttons. */
  actions?: ReactNode;
  /** A small icon before the label. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      onContextMenu={
        changed && onReset
          ? (event) => {
              event.preventDefault();
              onReset();
            }
          : undefined
      }
    >
      <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
        {changed ? (
          <span
            role="img"
            aria-label="Changed at this breakpoint"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
          />
        ) : null}
        {icon ? <span className="shrink-0 text-muted">{icon}</span> : null}
        <label htmlFor={htmlFor} className="text-xs font-medium text-body">
          {label}
        </label>
        {responsive ? (
          <Icon
            name="ph:laptop"
            width={12}
            height={12}
            className="shrink-0 text-subtle"
            aria-label="Can differ per breakpoint"
          />
        ) : null}
        {tip ? <InfoTip text={tip} label={label} placement="left" /> : null}
        <div className="ml-auto flex items-center gap-1">
          {actions}
          {changed && onReset ? (
            <button
              type="button"
              aria-label={`Reset ${label}`}
              title="Reset (or right-click the row)"
              onClick={onReset}
              className="rounded p-0.5 text-subtle transition-colors duration-150 hover:text-foreground"
            >
              <Icon name="ph:arrow-counter-clockwise" width={12} height={12} />
            </button>
          ) : null}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * A hand-made text field that looks and reacts exactly like FormInput: HeroUI v3's `input` class,
 * sized by globals.css (32px pill, 1px border, blue focus ring, red when aria-invalid).
 */
export const compactFieldClass = "input w-full min-w-0";

/** The grey shell around a Design value and its tools (unit, color, variable). */
export const fieldShellClass =
  "flex items-center rounded-medium bg-default-100 transition-colors hover:bg-default-200 focus-within:bg-default-200 focus-within:ring-1 focus-within:ring-default-800/30";

/** The input inside the shell: no background of its own. */
export const bareFieldClass =
  "h-9 w-full min-w-0 bg-transparent px-3 text-small text-foreground outline-none placeholder:text-default-400";

/** Square field used in the Design tab; sits flush against a tile button when joined. */
export const designFieldClass =
  "h-9 w-full min-w-0 bg-default-100 px-3 text-small text-foreground outline-none transition-colors placeholder:text-default-400 hover:bg-default-200 focus:bg-default-200 focus-visible:ring-1 focus-visible:ring-default-800/30";
