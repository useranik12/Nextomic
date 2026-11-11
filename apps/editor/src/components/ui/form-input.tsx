"use client";

import { Description, FieldError, Input, InputGroup, Label, TextField } from "@heroui/react";
import {
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { Icon } from "@/lib/icons/Icon";
import { InfoTip } from "./info-tip";

// The builder's one text field (HeroUI v3 TextField). Every field is the same 32px pill with one
// 1px border: the border lifts on hover, turns blue with a soft ring on focus, and turns red when
// invalid. The inner <input> never draws a border or outline of its own. `compact` only makes the
// label smaller and quieter for dense side panels (docs/ui-reference.md "Builder design rules").

export interface FormInputProps {
  label?: ReactNode;
  "aria-label"?: string;
  /** Info tip beside the label. */
  tip?: string;
  compact?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  name?: string;
  id?: string;
  autoComplete?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  spellCheck?: boolean | "true" | "false";
  autoFocus?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  /** Shown under the field while it is invalid. */
  errorMessage?: ReactNode;
  /** Help text under the field (hidden while an error shows). */
  description?: ReactNode;
  validationBehavior?: "aria" | "native";
  startContent?: ReactNode;
  endContent?: ReactNode;
  /** Shows a clear button while the field has text; clearing empties it, then calls `onClear`. */
  isClearable?: boolean;
  onClear?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onClick?: (event: MouseEvent<HTMLInputElement>) => void;
  className?: string;
}

const LABEL = {
  normal: "text-sm font-medium text-body",
  compact: "text-xs font-medium text-muted"
} as const;

export function FormInput({
  label,
  tip,
  compact,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  min,
  max,
  step,
  spellCheck,
  onClick,
  errorMessage,
  description,
  startContent,
  endContent,
  isClearable,
  onClear,
  className,
  ...field
}: FormInputProps) {
  const inputProps = { placeholder, min, max, step, spellCheck, onClick };
  const clear =
    isClearable && value ? (
      <button
        type="button"
        aria-label="Clear"
        onClick={() => {
          onValueChange?.("");
          onClear?.();
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-subtle outline-none hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Icon name="ph:x" width={14} height={14} />
      </button>
    ) : null;
  const suffix =
    endContent || clear ? (
      <>
        {clear}
        {endContent}
      </>
    ) : null;
  return (
    <TextField
      {...field}
      fullWidth
      value={value}
      defaultValue={defaultValue}
      onChange={onValueChange}
      className={className}
    >
      {label ? (
        <span className="flex items-center gap-1.5">
          <Label className={LABEL[compact ? "compact" : "normal"]}>{label}</Label>
          {tip ? (
            <InfoTip text={tip} label={typeof label === "string" ? label : undefined} />
          ) : null}
        </span>
      ) : null}
      {startContent || endContent || isClearable ? (
        <InputGroup fullWidth>
          {startContent ? (
            <InputGroup.Prefix className="border-0 ps-3 pe-2 text-subtle">
              {startContent}
            </InputGroup.Prefix>
          ) : null}
          <InputGroup.Input {...inputProps} />
          {suffix ? (
            <InputGroup.Suffix className="gap-1 border-0 ps-2 pe-1.5 text-subtle">
              {suffix}
            </InputGroup.Suffix>
          ) : null}
        </InputGroup>
      ) : (
        <Input {...inputProps} />
      )}
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

export function PasswordInput(props: Omit<FormInputProps, "type" | "endContent">) {
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
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted outline-none hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Icon name={visible ? "ph:eye-slash" : "ph:eye"} width={16} height={16} />
        </button>
      }
    />
  );
}
