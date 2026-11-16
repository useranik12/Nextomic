"use client";

import { Modal as V3Modal } from "@heroui/react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

// Compound modal for dialogs that need their own layout (forms, scrolling bodies, full screen).
// Simple confirm/form dialogs use `Dialog`. This wraps HeroUI v3's Modal with the builder's rules:
// blurred backdrop, overlay surface, focus trapped inside, Escape and the close button dismiss.

type ModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";

function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * The one sizing rule of every builder modal (owner rule, 2026-11-16): the box fits its content,
 * grows with it, and never exceeds the screen minus 1.5rem on any side. What is inside scrolls,
 * never the modal. `Dialog` uses the same constants.
 */
export const MODAL_CONTAINER = "p-3 sm:p-3";
export const MODAL_DIALOG =
  "max-h-full min-h-0 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl [&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col [&>form]:gap-4";
export const MODAL_HEADER = "shrink-0";
export const MODAL_FOOTER = "shrink-0";

const MAX_WIDTH: Record<ModalSize, string> = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: ""
};

interface ModalState {
  hideCloseButton: boolean;
  scroll: "inside" | "outside";
  base?: string;
  body?: string;
  size: ModalSize;
}

const ModalContext = createContext<ModalState>({
  hideCloseButton: false,
  scroll: "inside",
  size: "md"
});

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  size?: ModalSize;
  /** Extra classes: `base` is the dialog box, `body` the scrolling body. */
  classNames?: { base?: string; body?: string };
  children: ReactNode;
}

const POPOVER = '[data-slot$="popover"], [data-slot="popover-root"], .popover';

/**
 * A click outside an open select/popover inside a modal closes the popover, but react-aria also
 * counts it as a click outside the modal and closes that too. Remember, at the start of each press
 * or key, whether a popover was open; a modal close that follows within 400ms is ignored.
 */
export function usePopoverGuard(): () => boolean {
  const seenAt = useRef(0);
  useEffect(() => {
    function note() {
      if (document.querySelector(POPOVER)) seenAt.current = Date.now();
    }
    window.addEventListener("pointerdown", note, true);
    window.addEventListener("keydown", note, true);
    return () => {
      window.removeEventListener("pointerdown", note, true);
      window.removeEventListener("keydown", note, true);
    };
  }, []);
  return () => Date.now() - seenAt.current < 400;
}

export function Modal({
  isOpen,
  onClose,
  onOpenChange,
  isDismissable = true,
  hideCloseButton = false,
  size = "md",
  classNames,
  children
}: ModalProps) {
  const popoverJustClosed = usePopoverGuard();
  return (
    <ModalContext.Provider
      value={{
        hideCloseButton,
        scroll: "inside",
        base: classNames?.base,
        body: classNames?.body,
        size
      }}
    >
      <V3Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open && popoverJustClosed()) return;
          onOpenChange?.(open);
          if (!open) onClose?.();
        }}
      >
        <V3Modal.Backdrop variant="blur" isDismissable={isDismissable}>
          {children}
        </V3Modal.Backdrop>
      </V3Modal>
    </ModalContext.Provider>
  );
}

export function ModalContent({ children }: { children: ReactNode }) {
  const { hideCloseButton, scroll, base, size } = useContext(ModalContext);
  const full = size === "full";
  return (
    <V3Modal.Container
      scroll={scroll}
      size={full ? "full" : "md"}
      className={cn(MODAL_CONTAINER, full ? "" : "sm:w-full")}
    >
      <V3Modal.Dialog
        className={cn(
          "gap-4",
          MODAL_DIALOG,
          full
            ? "!h-[calc(100dvh-1.5rem)] !max-h-[calc(100dvh-1.5rem)] w-full max-w-none !rounded-3xl"
            : MAX_WIDTH[size],
          base
        )}
      >
        {hideCloseButton ? null : <V3Modal.CloseTrigger />}
        {children}
      </V3Modal.Dialog>
    </V3Modal.Container>
  );
}

export function ModalHeader({ children, className }: { children: ReactNode; className?: string }) {
  // The heading names the dialog for assistive tech (aria-labelledby).
  return (
    <V3Modal.Header className={MODAL_HEADER}>
      <V3Modal.Heading className={cn("text-base font-semibold text-foreground", className)}>
        {children}
      </V3Modal.Heading>
    </V3Modal.Header>
  );
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  const { body } = useContext(ModalContext);
  return (
    <V3Modal.Body className={cn("flex flex-col gap-3 text-sm text-body", body, className)}>
      {children}
    </V3Modal.Body>
  );
}

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <V3Modal.Footer className={cn(MODAL_FOOTER, "gap-2", className)}>{children}</V3Modal.Footer>
  );
}
