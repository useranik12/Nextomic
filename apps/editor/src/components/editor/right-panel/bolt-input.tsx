"use client";

import { tagText } from "@nextomic/schema";
import type { InputProps } from "@heroui/react";
import { FormInput } from "@/components/ui/controls";
import { DynamicBolt } from "./dynamic-bolt";

/** A compact text field with the dynamic bolt inside: static text mixed with {{tags}}. */
export function BoltInput({
  label,
  value,
  onValueChange,
  serverRun,
  ...rest
}: Omit<InputProps, "value" | "onValueChange" | "label" | "endContent"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Filled and used only on the server (query settings): the raw token is offered. */
  serverRun?: boolean;
}) {
  return (
    <FormInput
      compact
      label={label}
      value={value}
      onValueChange={onValueChange}
      endContent={
        <DynamicBolt
          label={label}
          serverRun={serverRun}
          onInsert={(token) => onValueChange(`${value}${tagText(token)}`)}
        />
      }
      {...rest}
    />
  );
}
