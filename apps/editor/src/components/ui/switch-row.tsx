"use client";

import { Switch } from "@heroui/react";
import { InfoTip } from "./info-tip";

/**
 * A switch with its label and an (i) tip. The tip sits beside the switch, not inside it: inside the
 * switch's label the tooltip never opens, because the label swallows hover and focus.
 */
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
    <div className="flex items-center gap-1.5">
      <Switch
        size="sm"
        isSelected={selected}
        isDisabled={disabled ?? false}
        onValueChange={onChange}
      >
        <span className="text-small">{label}</span>
      </Switch>
      <InfoTip text={tip} label={label} />
    </div>
  );
}
