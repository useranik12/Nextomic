"use client";

import { Tooltip } from "@heroui/react";
import { TOP_LAYER } from "./top-layer";
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
    <Tooltip delay={150} closeDelay={0}>
      <Tooltip.Trigger
        data-own-tip
        aria-label={`${label}: ${text}`}
        className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-subtle outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Icon name="ph:info" width={14} height={14} />
      </Tooltip.Trigger>
      <Tooltip.Content
        {...TOP_LAYER}
        placement={placement}
        className="z-[1000] max-w-64 text-xs leading-snug"
      >
        {text}
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * A field with its label and info tip above it. Tooltips do not open inside an input's own label,
 * so fields with a tip hide their label and sit under this one.
 */
export function TipField({
  label,
  tip,
  className,
  children
}: {
  label: string;
  tip: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"flex flex-col " + (className ?? "")}>
      <span className="flex items-center gap-1.5 pb-1 text-xs font-medium text-muted">
        <span>{label}</span>
        <InfoTip text={tip} label={label} />
      </span>
      {children}
    </div>
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
