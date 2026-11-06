"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FormInput, SelectField, type SelectOption } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";

// Small building blocks for the Animations editor. Every setting has an (i) tip in plain words, so
// nobody has to know GSAP to use it.

export function FieldLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="mb-1 flex items-center gap-1.5 text-tiny font-medium text-default-600">
      {label}
      <InfoTip text={tip} label={label} />
    </span>
  );
}

export function TipField({
  label,
  tip,
  children
}: {
  label: string;
  tip: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <FieldLabel label={label} tip={tip} />
      {children}
    </div>
  );
}

export function TextField({
  label,
  tip,
  value,
  onChange,
  placeholder,
  invalid
}: {
  label: string;
  tip: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <TipField label={label} tip={tip}>
      <FormInput
        compact
        aria-label={label}
        value={value}
        isInvalid={invalid ?? false}
        placeholder={placeholder ?? " "}
        onValueChange={onChange}
      />
    </TipField>
  );
}

/** A number box that lets you clear and retype; only a valid number inside the range is committed. */
export function NumberField({
  label,
  tip,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit
}: {
  label: string;
  tip: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const parsed = Number(text);
  const valid = text.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max;
  return (
    <TipField label={label} tip={tip}>
      <FormInput
        compact
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        isInvalid={!valid}
        endContent={unit ? <span className="text-tiny text-default-500">{unit}</span> : undefined}
        onValueChange={(next) => {
          setText(next);
          const n = Number(next);
          if (next.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </TipField>
  );
}

export function TipSelect({
  label,
  tip,
  value,
  options,
  onChange
}: {
  label: string;
  tip: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <TipField label={label} tip={tip}>
      <SelectField
        compact
        hideLabel
        label={label}
        value={value}
        options={options}
        onValueChange={onChange}
      />
    </TipField>
  );
}

/** A collapsible group of settings, like the sections in the Bricks and Bricksforge panels. */
export function Section({
  title,
  tip,
  defaultOpen = true,
  children
}: {
  title: string;
  tip: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-divider">
      <div className="flex items-center gap-1.5 px-4 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-small font-semibold outline-none focus-visible:ring-1 focus-visible:ring-default-800/40"
        >
          <Icon
            name="ph:caret-right"
            width={12}
            height={12}
            className={"transition-transform duration-300 " + (open ? "rotate-90" : "")}
          />
          {title}
        </button>
        <InfoTip text={tip} label={title} />
      </div>
      {open ? <div className="flex flex-col gap-3 px-4 pb-4">{children}</div> : null}
    </section>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
