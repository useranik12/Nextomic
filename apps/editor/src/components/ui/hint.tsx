"use client";

import { Tooltip } from "@heroui/react";
import { mergeProps } from "react-aria";
import { cloneElement, type ReactElement, type ReactNode } from "react";

type Placement = "top" | "bottom" | "left" | "right";

/**
 * A tooltip around ONE focusable child (button, link, tabindex=0 element). The child itself becomes
 * the trigger, so no extra wrapper element or nested interactive role is added. Opens after
 * `delay` ms (300 by default) on hover or keyboard focus, closes at once.
 */
export function Hint({
  content,
  placement = "top",
  delay = 300,
  children
}: {
  content: ReactNode;
  placement?: Placement;
  delay?: number;
  children: ReactElement<Record<string, unknown>>;
}) {
  return (
    <Tooltip delay={delay} closeDelay={0}>
      <Tooltip.Trigger
        render={(props) => cloneElement(children, mergeProps(children.props, props))}
      />
      <Tooltip.Content placement={placement} className="z-[1000] max-w-72 text-xs leading-snug">
        {content}
      </Tooltip.Content>
    </Tooltip>
  );
}
