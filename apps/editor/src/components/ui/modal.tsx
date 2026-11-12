"use client";

import { Modal as V3Modal } from "@heroui/react";
import { createContext, useContext, type ReactNode } from "react";

// Compound modal for dialogs that need their own layout (forms, scrolling bodies, full screen).
// Simple confirm/form dialogs use `Dialog`. This wraps HeroUI v3's Modal with the builder's rules:
// blurred backdrop, overlay surface, focus trapped inside, Escape and the close button dismiss.

type ModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";

function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

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
  scroll: "outside",
  size: "md"
});

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  size?: ModalSize;
  scrollBehavior?: "inside" | "outside";
  /** Extra classes: `base` is the dialog box, `body` the scrolling body. */
  classNames?: { base?: string; body?: string };
  children: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  onOpenChange,
  isDismissable = true,
  hideCloseButton = false,
  size = "md",
  scrollBehavior = "outside",
  classNames,
  children
}: ModalProps) {
  return (
    <ModalContext.Provider
      value={{
        hideCloseButton,
        scroll: scrollBehavior,
        base: classNames?.base,
        body: classNames?.body,
        size
      }}
    >
      <V3Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
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
      className={full ? "p-4 sm:p-4" : "sm:w-full"}
    >
      <V3Modal.Dialog
        className={cn(
          "gap-4 rounded-3xl",
          full ? "h-full min-h-0 w-full max-w-none rounded-3xl" : MAX_WIDTH[size],
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
  return (
    <V3Modal.Header className={cn("text-base font-semibold text-foreground", className)}>
      {children}
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
  return <V3Modal.Footer className={cn("gap-2", className)}>{children}</V3Modal.Footer>;
}
