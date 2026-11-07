"use client";

import {
  Button,
  Input,
  Select,
  SelectItem,
  type ButtonProps,
  type InputProps,
  type SelectProps
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";

// The builder's text fields and buttons. Use these everywhere instead of raw HeroUI Input/Button
// so every screen looks and reacts the same.
//
// Inputs follow blueprint/pages/editor-supabase.png: pill shape, one 2px outline, label above.
// Only that outline reacts (hover, focus, error); there is never a second border.
// Buttons: medium weight, 14px (12px small), short, and hover only changes colour (300ms). Colour
// carries meaning: `primary` uses the white shades of the default scale (inverts in light mode),
// `danger` is red, `ghost` is a quiet text button, `danger-ghost` is a quiet red one.

const INPUT_CLASSES: InputProps["classNames"] = {
  base: "gap-1",
  label: "pb-1 text-small font-medium !text-foreground",
  inputWrapper:
    "h-11 min-h-11 flex-row flex-nowrap items-center gap-2 rounded-full border border-default-200 bg-transparent px-5 shadow-none transition-colors " +
    "data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800 " +
    "group-data-[focus=true]:ring-4 group-data-[focus=true]:ring-default-800/10 " +
    "group-data-[invalid=true]:border-danger group-data-[invalid=true]:ring-0",
  innerWrapper: "h-full flex-nowrap items-center gap-2",
  input:
    "h-full min-w-0 flex-1 text-base text-foreground outline-none placeholder:text-default-400 data-[focus-visible=true]:outline-none",
  errorMessage: "px-2 text-tiny"
};

// Dense variant for side panels: same outline behaviour, 32px high, label to the left is not used.
const COMPACT_INPUT_CLASSES: InputProps["classNames"] = {
  ...INPUT_CLASSES,
  label: "pb-0.5 text-tiny font-medium !text-default-600",
  inputWrapper:
    "h-8 min-h-8 flex-row flex-nowrap items-center gap-2 rounded-full border border-default-200 bg-transparent px-3 shadow-none transition-colors " +
    "data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800 " +
    "group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-default-800/10 " +
    "group-data-[invalid=true]:border-danger group-data-[invalid=true]:ring-0",
  input:
    "h-full min-w-0 flex-1 text-small text-foreground outline-none placeholder:text-default-400 data-[focus-visible=true]:outline-none"
};

export function FormInput({ compact, ...props }: InputProps & { compact?: boolean }) {
  return (
    <Input
      variant="bordered"
      labelPlacement="outside-top"
      placeholder=" "
      classNames={compact ? COMPACT_INPUT_CLASSES : INPUT_CLASSES}
      {...props}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
  /** Shown but not selectable; `hint` says why when the pointer rests on it. */
  disabled?: boolean;
  hint?: string;
}

// Modern dropdown (HeroUI Select): pill trigger with the same 2px outline as the inputs, and a
// rounded popover with soft highlighting. Selection is controlled by `value`.
const SELECT_CLASSES = (compact: boolean): SelectProps["classNames"] => ({
  base: "gap-1",
  label: compact
    ? "pb-0.5 text-tiny font-medium !text-default-600"
    : "pb-1 text-small font-medium !text-foreground",
  trigger:
    (compact ? "h-8 min-h-8 px-3 " : "h-11 min-h-11 px-5 ") +
    "rounded-full border border-default-200 bg-transparent shadow-none transition-colors " +
    "data-[hover=true]:border-default-400 data-[focus=true]:border-default-800 " +
    "data-[open=true]:border-default-800 data-[focus-visible=true]:ring-1 data-[focus-visible=true]:ring-default-800/10",
  value: (compact ? "text-small " : "text-base ") + "text-foreground",
  selectorIcon: "text-default-500",
  popoverContent: "min-w-[160px] rounded-large border border-default-200 bg-content1 p-1 shadow-xl",
  listbox: "gap-0.5 p-0"
});

const ITEM_CLASSES = {
  base:
    "rounded-medium px-3 py-1.5 text-small text-default-700 transition-colors " +
    "data-[hover=true]:bg-default-100 data-[hover=true]:text-foreground " +
    "data-[selected=true]:bg-default-200 data-[selected=true]:font-medium data-[selected=true]:text-foreground " +
    "data-[focus-visible=true]:ring-1 data-[focus-visible=true]:ring-default-800/20 " +
    // Disabled choices stay hoverable so their hint can explain how to enable them.
    "data-[disabled=true]:pointer-events-auto data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45"
};

export interface SelectFieldProps {
  /** Visible label. With `hideLabel` it becomes the accessible name only. */
  label: string;
  hideLabel?: boolean;
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  compact?: boolean;
  isDisabled?: boolean;
  className?: string;
}

export function SelectField({
  label,
  hideLabel,
  options,
  value,
  onValueChange,
  compact = false,
  isDisabled,
  className
}: SelectFieldProps) {
  // Opening the list inside a scrolling modal makes the modal body fire one stray scroll event, and
  // react-aria closes a popover on any scroll above its trigger. Ignore scrolls right after opening.
  const openedAt = useRef(0);
  useEffect(() => {
    function ignoreOpeningScroll(event: Event) {
      if (Date.now() - openedAt.current < 400) event.stopImmediatePropagation();
    }
    window.addEventListener("scroll", ignoreOpeningScroll, true);
    return () => window.removeEventListener("scroll", ignoreOpeningScroll, true);
  }, []);
  const known = options.some((option) => option.value === value);
  const items = known ? options : [{ value, label: value }, ...options];
  return (
    <Select
      aria-label={label}
      label={hideLabel ? undefined : label}
      labelPlacement="outside"
      variant="bordered"
      disallowEmptySelection
      isDisabled={isDisabled}
      onOpenChange={(open) => {
        if (open) openedAt.current = Date.now();
      }}
      selectedKeys={[value]}
      disabledKeys={items.filter((option) => option.disabled).map((option) => option.value)}
      onSelectionChange={(keys) => {
        const next = Array.from(keys)[0];
        if (next !== undefined) onValueChange(String(next));
      }}
      classNames={SELECT_CLASSES(compact)}
      className={className}
      popoverProps={{ offset: 6, placement: "bottom-start" }}
      listboxProps={{ itemClasses: ITEM_CLASSES }}
      selectorIcon={<Icon name="ph:caret-down" width={14} height={14} />}
    >
      {items.map((option) => (
        <SelectItem key={option.value} textValue={option.label}>
          {option.hint ? (
            <span data-tip={option.hint} className="block w-full">
              {option.label}
            </span>
          ) : (
            option.label
          )}
        </SelectItem>
      ))}
    </Select>
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
          className="rounded-full p-1 text-default-500 outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-default-800"
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
  primary: "bg-default-800 text-default-50 data-[hover=true]:bg-default-700",
  danger: "bg-danger text-white data-[hover=true]:bg-danger-600",
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
        `${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} min-w-0 font-medium transition-colors duration-300 data-[hover=true]:opacity-100 ` +
        (className ?? "")
      }
      {...props}
    />
  );
}
