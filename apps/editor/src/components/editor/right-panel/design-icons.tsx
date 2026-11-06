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
    case "group-transform":
      return <Icon name="ph:cube" width={18} height={18} />;
    case "group-filters":
      return <Icon name="ph:sliders-horizontal" width={18} height={18} />;
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

/** The small icon before a setting's label, chosen by the CSS property. Unknown properties get none. */
export function PropertyIcon({ property }: { property: string }) {
  switch (property) {
    case "display":
      return <Icon name="ph:eye" width={14} height={14} />;
    case "flex-wrap":
      return <Icon name="ph:arrow-bend-down-right" width={14} height={14} />;
    case "flex-direction":
      return <Icon name="ph:arrows-out-cardinal" width={14} height={14} />;
    case "align-self":
      return <Icon name="ph:align-top-simple" width={14} height={14} />;
    case "justify-content":
      return <Icon name="ph:arrows-horizontal" width={14} height={14} />;
    case "align-items":
      return <Icon name="ph:arrows-vertical" width={14} height={14} />;
    case "gap":
      return <Icon name="ph:dots-three" width={14} height={14} />;
    case "column-gap":
      return <Icon name="ph:columns" width={14} height={14} />;
    case "row-gap":
      return <Icon name="ph:rows" width={14} height={14} />;
    case "flex-grow":
      return <Icon name="ph:arrows-out-line-horizontal" width={14} height={14} />;
    case "flex-shrink":
      return <Icon name="ph:arrows-in-line-horizontal" width={14} height={14} />;
    case "flex-basis":
      return <Icon name="ph:ruler" width={14} height={14} />;
    case "order":
      return <Icon name="ph:sort-ascending" width={14} height={14} />;
    case "width":
      return <Icon name="ph:arrows-left-right" width={14} height={14} />;
    case "min-width":
      return <Icon name="ph:arrows-in-line-horizontal" width={14} height={14} />;
    case "max-width":
      return <Icon name="ph:arrows-out-line-horizontal" width={14} height={14} />;
    case "height":
      return <Icon name="ph:arrows-vertical" width={14} height={14} />;
    case "min-height":
      return <Icon name="ph:arrows-in" width={14} height={14} />;
    case "max-height":
      return <Icon name="ph:arrows-out-line-vertical" width={14} height={14} />;
    case "aspect-ratio":
      return <Icon name="ph:frame-corners" width={14} height={14} />;
    case "object-fit":
      return <Icon name="ph:image" width={14} height={14} />;
    case "font-family":
      return <Icon name="ph:text-t" width={14} height={14} />;
    case "font-size":
      return <Icon name="ph:text-aa" width={14} height={14} />;
    case "font-weight":
      return <Icon name="ph:text-b" width={14} height={14} />;
    case "font-style":
      return <Icon name="ph:text-italic" width={14} height={14} />;
    case "line-height":
      return <Icon name="ph:text-h" width={14} height={14} />;
    case "text-align":
      return <Icon name="ph:text-align-left" width={14} height={14} />;
    case "color":
      return <Icon name="ph:palette" width={14} height={14} />;
    case "letter-spacing":
      return <Icon name="ph:text-columns" width={14} height={14} />;
    case "text-transform":
      return <Icon name="ph:text-aa" width={14} height={14} />;
    case "text-decoration-line":
      return <Icon name="ph:text-underline" width={14} height={14} />;
    case "white-space":
      return <Icon name="ph:text-strikethrough" width={14} height={14} />;
    case "background-color":
      return <Icon name="ph:palette" width={14} height={14} />;
    case "background-image":
      return <Icon name="ph:image" width={14} height={14} />;
    case "background-size":
      return <Icon name="ph:resize" width={14} height={14} />;
    case "background-position":
      return <Icon name="ph:crosshair" width={14} height={14} />;
    case "background-repeat":
      return <Icon name="ph:grid-four" width={14} height={14} />;
    case "border-width":
      return <Icon name="ph:square" width={14} height={14} />;
    case "border-style":
      return <Icon name="ph:selection" width={14} height={14} />;
    case "border-color":
      return <Icon name="ph:palette" width={14} height={14} />;
    case "border-radius":
      return <Icon name="ph:corners-out" width={14} height={14} />;
    case "outline":
      return <Icon name="ph:selection-all" width={14} height={14} />;
    case "position":
      return <Icon name="ph:crosshair" width={14} height={14} />;
    case "inset":
      return <Icon name="ph:scan" width={14} height={14} />;
    case "z-index":
      return <Icon name="ph:stack-simple" width={14} height={14} />;
    case "overflow":
      return <Icon name="ph:selection" width={14} height={14} />;
    case "opacity":
      return <Icon name="ph:circle-half" width={14} height={14} />;
    case "box-shadow":
      return <Icon name="ph:drop" width={14} height={14} />;
    case "cursor":
      return <Icon name="ph:cursor" width={14} height={14} />;
    case "pointer-events":
      return <Icon name="ph:cursor-click" width={14} height={14} />;
    case "transform":
      return <Icon name="ph:cube" width={14} height={14} />;
    case "transform-origin":
      return <Icon name="ph:crosshair" width={14} height={14} />;
    case "transform-style":
      return <Icon name="ph:stack" width={14} height={14} />;
    case "transform-box":
      return <Icon name="ph:rectangle" width={14} height={14} />;
    case "filter":
      return <Icon name="ph:sliders-horizontal" width={14} height={14} />;
    case "backdrop-filter":
      return <Icon name="ph:aperture" width={14} height={14} />;
    case "transition":
      return <Icon name="ph:timer" width={14} height={14} />;
    case "margin":
      return <Icon name="ph:arrows-out-cardinal" width={14} height={14} />;
    case "padding":
      return <Icon name="ph:square-half" width={14} height={14} />;
    default:
      return null;
  }
}
