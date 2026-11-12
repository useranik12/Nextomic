"use client";

import { Popover as V3Popover } from "@heroui/react";
import { mergeProps } from "react-aria";
import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode
} from "react";

// The builder's floating panel (HeroUI v3 Popover) with the compound shape the panels use:
// <Popover><PopoverTrigger>one button</PopoverTrigger><PopoverContent>...</PopoverContent></Popover>.
// The trigger is the child button itself (no wrapper), the panel is an `overlay` surface.

type Placement =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top start"
  | "top end"
  | "bottom start"
  | "bottom end"
  | "left start"
  | "left end"
  | "right start"
  | "right end"
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end";

const PlacementContext = createContext<{ placement: string; offset: number }>({
  placement: "bottom end",
  offset: 8
});

export interface PopoverProps {
  children: ReactNode;
  placement?: Placement;
  offset?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Keep the panel open when a parent scrolls (a modal that scrolls its focused field into view). */
  shouldCloseOnScroll?: boolean;
}

export function Popover({
  children,
  placement = "bottom end",
  offset = 8,
  isOpen,
  onOpenChange,
  shouldCloseOnScroll = true
}: PopoverProps) {
  const openedAt = useRef(0);
  const open = useRef(false);
  useEffect(() => {
    function onScroll(event: Event) {
      const opening = Date.now() - openedAt.current < 400;
      if (opening || (open.current && !shouldCloseOnScroll)) event.stopImmediatePropagation();
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [shouldCloseOnScroll]);
  return (
    <PlacementContext.Provider value={{ placement: placement.replace("-", " "), offset }}>
      <V3Popover
        isOpen={isOpen}
        onOpenChange={(next) => {
          open.current = next;
          if (next) openedAt.current = Date.now();
          onOpenChange?.(next);
        }}
      >
        {children}
      </V3Popover>
    </PlacementContext.Provider>
  );
}

export function PopoverTrigger({ children }: { children: ReactElement<Record<string, unknown>> }) {
  return (
    <V3Popover.Trigger
      render={(props) => cloneElement(children, mergeProps(children.props, props))}
    />
  );
}

export function PopoverContent({
  children,
  className
}: {
  children: ReactNode;
  /** Classes for the panel body: padding and width. */
  className?: string;
}) {
  const { placement, offset } = useContext(PlacementContext);
  return (
    <V3Popover.Content placement={placement as "bottom end"} offset={offset} className="rounded-xl">
      <V3Popover.Dialog className={className ?? "p-2"}>{children}</V3Popover.Dialog>
    </V3Popover.Content>
  );
}
