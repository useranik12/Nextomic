"use client";

import { Button, buttonVariants, Spinner, type ButtonProps } from "@heroui/react";
import Link from "next/link";
import type { ReactNode } from "react";

// The builder's one button (HeroUI v3). Tones carry meaning, never decoration (docs/ui-reference.md
// "Builder design rules"):
//   primary       the one main action of a view: page inverse (white in dark mode), dims on hover
//   secondary     a second action beside primary: soft gray fill, lifts on hover
//   outline       a third-level action: 1px border, fills with the same gray on hover
//   ghost         quiet text or icon button in toolbars and lists
//   danger        confirms a destructive action (solid red)
//   danger-ghost  a quiet destructive action (red text, soft red on hover)
// Blue is never a button colour; it marks focus, links, selection and info only.

export type ActionTone = "primary" | "secondary" | "outline" | "ghost" | "danger" | "danger-ghost";
export type ActionSize = "sm" | "md";

const VARIANT = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  danger: "danger",
  "danger-ghost": "ghost"
} as const satisfies Record<ActionTone, ButtonProps["variant"]>;

// sm matches the 32px fields; md is for dialog footers and page actions.
const SIZE: Record<ActionSize, string> = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm" };
const ICON_SIZE: Record<ActionSize, string> = { sm: "w-8 px-0", md: "w-9 px-0" };

export interface ActionButtonProps
  extends Omit<ButtonProps, "variant" | "size" | "className" | "children" | "isPending"> {
  tone?: ActionTone;
  size?: ActionSize;
  className?: string;
  children?: ReactNode;
  /** Shows a spinner and blocks presses while an action runs. */
  isLoading?: boolean;
  startContent?: ReactNode;
  endContent?: ReactNode;
  /** Renders a link that looks like the button. */
  href?: string;
}

function classesFor(
  tone: ActionTone,
  size: ActionSize,
  isIconOnly: boolean | undefined,
  className: string | undefined
): string {
  return [
    "min-w-0",
    isIconOnly ? `${SIZE[size].split(" ")[0]} ${ICON_SIZE[size]}` : SIZE[size],
    tone === "danger-ghost" ? "button--danger-ghost" : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");
}

export function ActionButton({
  tone = "primary",
  size = "md",
  className,
  isLoading,
  startContent,
  endContent,
  href,
  isIconOnly,
  isDisabled,
  children,
  ...props
}: ActionButtonProps) {
  const classes = classesFor(tone, size, isIconOnly, className);
  if (href) {
    return (
      <Link
        href={href}
        aria-label={props["aria-label"]}
        className={buttonVariants({ variant: VARIANT[tone], isIconOnly }) + " " + classes}
      >
        {startContent}
        {children}
        {endContent}
      </Link>
    );
  }
  return (
    <Button
      variant={VARIANT[tone]}
      isIconOnly={isIconOnly}
      isDisabled={isDisabled}
      isPending={isLoading}
      className={classes}
      {...props}
    >
      {isLoading ? <Spinner size="sm" color="current" /> : startContent}
      {children}
      {endContent}
    </Button>
  );
}
