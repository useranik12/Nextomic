"use client";

import type { InputProps } from "@heroui/react";
import { FormInput } from "@/components/ui/controls";
import { DynamicBolt } from "./dynamic-bolt";

/** A compact text field with the dynamic bolt inside: static text mixed with {{tags}}. */
export function BoltInput({
  label,
  value,
  onValueChange,
  ...rest
}: Omit<InputProps, "value" | "onValueChange" | "label" | "endContent"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <FormInput
      compact
      label={label}
      value={value}
      onValueChange={onValueChange}
      endContent={
        <DynamicBolt label={label} onInsert={(token) => onValueChange(`${value}{{${token}}}`)} />
      }
      {...rest}
    />
  );
}
