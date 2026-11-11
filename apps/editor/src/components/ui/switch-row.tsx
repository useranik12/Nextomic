"use client";

import { Toggle } from "./toggles";

/** A switch with its label and an (i) tip beside it (outside the label, so hover reaches it). */
export function SwitchRow({
  label,
  tip,
  selected,
  onChange,
  disabled
}: {
  label: string;
  tip: string;
  selected: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Toggle
      label={label}
      tip={tip}
      isSelected={selected}
      onChange={onChange}
      isDisabled={disabled ?? false}
    />
  );
}
