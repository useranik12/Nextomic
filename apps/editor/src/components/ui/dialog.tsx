"use client";

import { Modal } from "@heroui/react";
import type { ReactNode } from "react";
import { usePopoverGuard } from "./modal";

// The builder's dialog (HeroUI v3 Modal): blurred backdrop, overlay surface, fade and scale in,
// focus trapped inside, Escape and the close button dismiss it. Footer buttons follow the button
// rules: the main action is `primary`, Cancel is `secondary`, a destructive confirm is `danger`.

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One line under the title saying what the dialog is for. */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned. */
  footer?: ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  /** Clicking the backdrop closes the dialog (default). Turn off while a form is half-filled. */
  isDismissable?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  isDismissable = true
}: DialogProps) {
  const popoverJustClosed = usePopoverGuard();
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => (open || popoverJustClosed() ? undefined : onClose())}
    >
      <Modal.Backdrop variant="blur" isDismissable={isDismissable}>
        <Modal.Container size={size}>
          <Modal.Dialog className="gap-5 rounded-3xl">
            <Modal.CloseTrigger />
            <Modal.Header className="gap-1">
              <Modal.Heading className="text-base font-semibold text-foreground">
                {title}
              </Modal.Heading>
              {description ? <p className="text-sm text-muted">{description}</p> : null}
            </Modal.Header>
            {children ? <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body> : null}
            {footer ? <Modal.Footer className="gap-2">{footer}</Modal.Footer> : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
