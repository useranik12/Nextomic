"use client";

import { tagText } from "@nextomic/schema";
import { FormInput, type FormInputProps } from "@/components/ui/controls";
import { ClearAdornment } from "@/components/ui/floating-adornments";
import { DynamicBolt } from "./dynamic-bolt";

/** A compact text field with the dynamic bolt inside: static text mixed with {{tags}}. */
export function BoltInput({
  label,
  value,
  onValueChange,
  serverRun,
  tip,
  ...rest
}: Omit<FormInputProps, "value" | "onValueChange" | "label" | "endContent" | "adornments"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Filled and used only on the server (query settings): the raw token is offered. */
  serverRun?: boolean;
  /** Info tip beside the label. */
  tip?: string;
}) {
  return (
    <FormInput
      compact
      label={label}
      tip={tip}
      value={value}
      onValueChange={onValueChange}
      adornments={
        <>
          <DynamicBolt
            label={label}
            serverRun={serverRun}
            onInsert={(token) => onValueChange(`${value}${tagText(token)}`)}
          />
          {value !== "" && !rest.isDisabled && !rest.isReadOnly ? (
            <ClearAdornment label={label} onClear={() => onValueChange("")} />
          ) : null}
        </>
      }
      {...rest}
    />
  );
}
