"use client";

import { Modal as V2Modal, type ModalProps } from "@heroui-v2/react";
import { useEffect, useId } from "react";

// HeroUI v2 modal for screens the v3 sweep has not reached yet. v2 and v3 keep separate overlay
// stacks, so v2's own "click outside closes" treats a click inside a v3 popover (Select, ComboBox,
// DatePicker) as outside and closes the modal; v2 also ignores `shouldCloseOnInteractOutside`.
// This wrapper turns v2's outside handling off and closes only on a press on the modal's own
// backdrop area, which a v3 popover never is. Escape and the close button still close it.
// Remove it, with the `@heroui-v2/react` alias, when the last v2 modal moves to `Dialog`.

export function Modal({ isDismissable = true, classNames, ...props }: ModalProps) {
  const backdropClass = `nx-legacy-modal-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { isOpen, onOpenChange, onClose } = props;
  const listening = isDismissable && isOpen === true;

  useEffect(() => {
    if (!listening) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !target.classList.contains(backdropClass)) return;
      onOpenChange?.(false);
      onClose?.();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [listening, backdropClass, onOpenChange, onClose]);

  return (
    <V2Modal
      {...props}
      isDismissable={false}
      classNames={{
        ...classNames,
        wrapper: [classNames?.wrapper, backdropClass].filter(Boolean).join(" ")
      }}
    />
  );
}
