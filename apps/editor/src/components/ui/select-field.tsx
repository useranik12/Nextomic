"use client";

import { Description, Label, ListBox, Select } from "@heroui/react";
import { TOP_LAYER } from "./top-layer";
import { useEffect, useRef, type ReactNode } from "react";
import { InfoTip } from "./info-tip";

// The builder's dropdown (HeroUI v3 Select): the same 32px pill as the text fields, a rounded
// popover, a check on the chosen item. Selection is controlled by `value`.

export interface SelectOption {
  value: string;
  label: string;
  /** Shown but not selectable; `hint` says why when the pointer rests on it. */
  disabled?: boolean;
  hint?: string;
}

export interface SelectFieldProps {
  /** Visible label. With `hideLabel` it becomes the accessible name only. */
  label: string;
  hideLabel?: boolean;
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  compact?: boolean;
  isDisabled?: boolean;
  /** Help text under the field. */
  description?: string;
  className?: string;
  /** Info tip beside the label. */
  tip?: string;
}

/**
 * Opening a list inside a scrolling panel or modal makes it fire a stray scroll event (the trigger
 * scrolls into view), and react-aria closes a popover on any scroll above its trigger. The returned
 * `onOpenChange` handler marks the opening; scrolls in the next 400ms are ignored.
 */
export function useIgnoreOpeningScroll(): (open: boolean) => void {
  const openedAt = useRef(0);
  useEffect(() => {
    function ignoreOpeningScroll(event: Event) {
      if (Date.now() - openedAt.current < 400) event.stopImmediatePropagation();
    }
    window.addEventListener("scroll", ignoreOpeningScroll, true);
    return () => window.removeEventListener("scroll", ignoreOpeningScroll, true);
  }, []);
  return (open) => {
    if (open) openedAt.current = Date.now();
  };
}

const LABEL = {
  normal: "text-sm font-medium text-body in-data-[invalid=true]:text-danger",
  compact: "text-xs font-medium text-muted in-data-[invalid=true]:text-danger"
} as const;

function FieldLabel({ label, tip, compact }: { label: string; tip?: string; compact: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <Label className={LABEL[compact ? "compact" : "normal"]}>{label}</Label>
      {tip ? <InfoTip text={tip} label={label} /> : null}
    </span>
  );
}

function Items({ items }: { items: SelectOption[] }) {
  return items.map((option) => (
    <ListBox.Item
      key={option.value}
      id={option.value}
      textValue={option.label}
      isDisabled={option.disabled}
      // Disabled choices stay hoverable so their hint can explain how to enable them.
      className="text-body data-[disabled=true]:pointer-events-auto data-[disabled=true]:cursor-not-allowed data-[selected=true]:font-medium data-[selected=true]:text-foreground"
    >
      {option.hint ? (
        <span data-tip={option.hint} className="block w-full">
          {option.label}
        </span>
      ) : (
        option.label
      )}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  ));
}

function Trigger({ placeholder }: { placeholder?: ReactNode }) {
  return (
    <>
      <Select.Trigger>
        <Select.Value>
          {({ isPlaceholder, defaultChildren }) =>
            isPlaceholder && placeholder ? placeholder : defaultChildren
          }
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
    </>
  );
}

export function SelectField({
  label,
  hideLabel,
  options,
  value,
  onValueChange,
  compact = false,
  isDisabled,
  description,
  className,
  tip
}: SelectFieldProps) {
  const markOpened = useIgnoreOpeningScroll();
  const known = options.some((option) => option.value === value);
  const items = known ? options : [{ value, label: value }, ...options];
  return (
    <Select
      fullWidth
      aria-label={label}
      isDisabled={isDisabled}
      value={value}
      onChange={(next) => {
        if (next !== null) onValueChange(String(next));
      }}
      onOpenChange={markOpened}
      className={className}
    >
      {hideLabel ? null : <FieldLabel label={label} tip={tip} compact={compact} />}
      <Trigger />
      {description ? <Description>{description}</Description> : null}
      <Select.Popover {...TOP_LAYER} placement="bottom start" offset={6}>
        <ListBox>
          <Items items={items} />
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** A select that picks any number of options; an empty pick is allowed. */
export function MultiSelectField({
  label,
  options,
  values,
  onValuesChange,
  compact = false,
  isDisabled,
  description,
  placeholder,
  tip
}: Omit<SelectFieldProps, "value" | "onValueChange" | "hideLabel" | "className"> & {
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const markOpened = useIgnoreOpeningScroll();
  // Picked values missing from the options (a renamed column) stay visible so they can be removed.
  const missing = values.filter((v) => !options.some((o) => o.value === v));
  const items = [...missing.map((v) => ({ value: v, label: v })), ...options];
  return (
    <Select
      fullWidth
      selectionMode="multiple"
      aria-label={label}
      isDisabled={isDisabled}
      value={values}
      onChange={(next) => onValuesChange(next.map(String))}
      onOpenChange={markOpened}
    >
      <FieldLabel label={label} tip={tip} compact={compact} />
      <Trigger placeholder={placeholder} />
      {description ? <Description>{description}</Description> : null}
      <Select.Popover {...TOP_LAYER} placement="bottom start" offset={6}>
        <ListBox selectionMode="multiple">
          <Items items={items} />
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
