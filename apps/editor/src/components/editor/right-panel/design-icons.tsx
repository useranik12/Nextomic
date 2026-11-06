"use client";

import { Icon } from "@/lib/icons/Icon";

const SIZE = { width: 16, height: 16 };

/**
 * Icons for Design groups and for icon-toggle options. Every icon is a literal name so the icon
 * lint can see it. Unknown keys render nothing.
 */
export function DesignIcon({ id }: { id: string }) {
  switch (id) {
    case "group-layout":
      return <Icon name="ph:layout" width={18} height={18} />;
    case "group-spacing":
      return <Icon name="ph:arrows-out-cardinal" width={18} height={18} />;
    case "group-size":
      return <Icon name="ph:ruler" width={18} height={18} />;
    case "group-typography":
      return <Icon name="ph:text-aa" width={18} height={18} />;
    case "group-background":
      return <Icon name="ph:paint-bucket" width={18} height={18} />;
    case "group-position":
      return <Icon name="ph:crosshair" width={18} height={18} />;
    case "group-effects":
      return <Icon name="ph:sparkle" width={18} height={18} />;
    case "group-border":
      return <Icon name="ph:square" width={18} height={18} />;
    case "row":
      return <Icon name="ph:arrow-right" {...SIZE} />;
    case "column":
      return <Icon name="ph:arrow-down" {...SIZE} />;
    case "row-reverse":
      return <Icon name="ph:arrow-left" {...SIZE} />;
    case "column-reverse":
      return <Icon name="ph:arrow-up" {...SIZE} />;
    case "start":
      return <Icon name="ph:align-left-simple" {...SIZE} />;
    case "center":
      return <Icon name="ph:align-center-horizontal-simple" {...SIZE} />;
    case "end":
      return <Icon name="ph:align-right-simple" {...SIZE} />;
    case "between":
      return <Icon name="ph:arrows-horizontal" {...SIZE} />;
    case "around":
      return <Icon name="ph:arrows-out-line-horizontal" {...SIZE} />;
    case "top":
      return <Icon name="ph:align-top-simple" {...SIZE} />;
    case "middle":
      return <Icon name="ph:align-center-vertical-simple" {...SIZE} />;
    case "bottom":
      return <Icon name="ph:align-bottom-simple" {...SIZE} />;
    case "stretch":
      return <Icon name="ph:arrows-vertical" {...SIZE} />;
    case "baseline":
      return <Icon name="ph:text-aa" {...SIZE} />;
    case "text-left":
      return <Icon name="ph:text-align-left" {...SIZE} />;
    case "text-center":
      return <Icon name="ph:text-align-center" {...SIZE} />;
    case "text-right":
      return <Icon name="ph:text-align-right" {...SIZE} />;
    case "text-justify":
      return <Icon name="ph:text-align-justify" {...SIZE} />;
    default:
      return null;
  }
}
