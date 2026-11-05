"use client";

import type { BreakpointIcon } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";

// Icons for data-driven choices (element types, breakpoint icons). `icons:lint` needs literal
// names in JSX, so each choice maps to its own <Icon> here.

const SIZE = { width: 20, height: 20 } as const;

export function ElementIcon({ type, size = 28 }: { type: string; size?: number }) {
  const props = { width: size, height: size };
  switch (type) {
    case "section":
      return <Icon name="ph:rows" {...props} />;
    case "container":
      return <Icon name="ph:square" {...props} />;
    case "heading":
      return <Icon name="ph:text-h" {...props} />;
    case "text":
      return <Icon name="ph:text-align-left" {...props} />;
    case "button":
      return <Icon name="ph:cursor-click" {...props} />;
    case "image":
      return <Icon name="ph:image" {...props} />;
    default:
      return <Icon name="ph:square" {...props} />;
  }
}

export function BreakpointGlyph({ icon }: { icon: BreakpointIcon }) {
  switch (icon) {
    case "laptop":
      return <Icon name="ph:laptop" {...SIZE} />;
    case "tablet":
      return <Icon name="ph:device-tablet" {...SIZE} />;
    case "mobile":
      return <Icon name="ph:device-mobile" {...SIZE} />;
    default:
      return <Icon name="ph:desktop" {...SIZE} />;
  }
}
