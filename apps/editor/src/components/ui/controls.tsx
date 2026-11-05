"use client";

import { Button, Input, type ButtonProps, type InputProps } from "@heroui/react";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";

// The builder's text fields and buttons. Use these everywhere instead of raw HeroUI Input/Button
// so every screen looks and reacts the same.
//
// Inputs follow blueprint/pages/editor-supabase.png: pill shape, one 2px outline, label above.
// Only that outline reacts (hover, focus, error); there is never a second border.
// Buttons: medium weight, short, and they lift slightly on hover (transform, 300ms). Colour carries
// meaning: `primary` uses the white shades of the default scale (inverts in light mode), `danger`
// is red, `ghost` is a quiet text button, `danger-ghost` is a quiet red one.

const INPUT_CLASSES: InputProps["classNames"] = {
  base: "gap-1",
  label: "pb-1 text-small font-medium !text-foreground",
  inputWrapper:
    "h-11 min-h-11 flex-row flex-nowrap items-center gap-2 rounded-full border-2 border-default-200 bg-transparent px-5 shadow-none transition-colors " +
    "data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800 " +
    "group-data-[focus=true]:ring-4 group-data-[focus=true]:ring-default-800/10 " +
    "group-data-[invalid=true]:border-danger group-data-[invalid=true]:ring-0",
  innerWrapper: "h-full flex-nowrap items-center gap-2",
  input:
    "h-full min-w-0 flex-1 text-base text-foreground outline-none placeholder:text-default-400 data-[focus-visible=true]:outline-none",
  errorMessage: "px-2 text-tiny"
};

export function FormInput(props: InputProps) {
  return (
    <Input
      variant="bordered"
      labelPlacement="outside-top"
      placeholder=" "
      classNames={INPUT_CLASSES}
      {...props}
    />
  );
}

export function PasswordInput(props: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <FormInput
      {...props}
      type={visible ? "text" : "password"}
      endContent={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="rounded-full p-1 text-default-500 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-default-800"
        >
          {visible ? (
            <Icon name="ph:eye-slash" width={20} height={20} />
          ) : (
            <Icon name="ph:eye" width={20} height={20} />
          )}
        </button>
      }
    />
  );
}

export type ActionTone = "primary" | "danger" | "ghost" | "danger-ghost";

const TONE_CLASSES: Record<ActionTone, string> = {
  primary: "bg-default-800 text-default-50",
  danger: "bg-danger text-white",
  ghost: "bg-transparent text-default-600 data-[hover=true]:bg-default-100",
  "danger-ghost": "bg-transparent text-danger data-[hover=true]:bg-danger/10"
};

const SIZE_CLASSES = { md: "h-10 px-5 text-small", sm: "h-8 px-3 text-tiny" } as const;

export interface ActionButtonProps extends Omit<ButtonProps, "color" | "variant" | "size"> {
  tone?: ActionTone;
  size?: keyof typeof SIZE_CLASSES;
}

export function ActionButton({
  tone = "primary",
  size = "md",
  className,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      radius="full"
      className={
        `${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} min-w-0 !font-medium ` +
        "!transition-[transform,background-color,box-shadow] duration-300 ease-out " +
        "data-[hover=true]:-translate-y-px data-[hover=true]:scale-[1.03] data-[hover=true]:opacity-100 " +
        "data-[pressed=true]:scale-[0.98] " +
        (className ?? "")
      }
      {...props}
    />
  );
}
