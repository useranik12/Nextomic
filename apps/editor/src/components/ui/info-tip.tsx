"use client";

import { Tooltip } from "@heroui/react";
import { Icon } from "@/lib/icons/Icon";

/**
 * A small (i) beside a setting. Hover or focus shows what the setting does, in plain words. Keep
 * the text to one or two sentences and say what changes, not what the control is called.
 */
export function InfoTip({
  text,
  label = "More information",
  placement = "top"
}: {
  text: string;
  label?: string;
  placement?: "top" | "left" | "right" | "bottom";
}) {
  return (
    <Tooltip
      content={<span className="block max-w-64 px-1 py-0.5 text-tiny leading-snug">{text}</span>}
      placement={placement}
      delay={150}
      closeDelay={0}
      classNames={{ base: "z-[1000]" }}
    >
      <button
        type="button"
        data-own-tip
        aria-label={`${label}: ${text}`}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:text-foreground focus-visible:ring-1 focus-visible:ring-default-800/40"
      >
        <Icon name="ph:info" width={14} height={14} />
      </button>
    </Tooltip>
  );
}

/** A label with its info tip, for rows that have no input label of their own. */
export function LabelWithTip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{children}</span>
      <InfoTip text={tip} />
    </span>
  );
}
