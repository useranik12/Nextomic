"use client";

import { Checkbox, Description, Label, Switch } from "@heroui/react";
import type { ReactNode } from "react";
import { InfoTip } from "./info-tip";

// The builder's on/off controls (HeroUI v3). Both animate when toggled: the switch thumb slides,
// the checkbox fill grows and the check draws in. "On" is the blue accent, because blue marks a
// selected state (docs/ui-reference.md "Builder design rules").

interface ToggleBase {
  /** Visible label; when it is not a string, pass `aria-label` too. */
  label?: ReactNode;
  "aria-label"?: string;
  isSelected: boolean;
  onChange: (on: boolean) => void;
  isDisabled?: boolean;
  /** Help text under the label. */
  description?: ReactNode;
  /** Info tip beside the control (outside its label, so hover reaches it). */
  tip?: string;
  className?: string;
}

const LABEL = "text-sm font-normal text-body";

function withTip(control: ReactNode, tip: string | undefined, label: ReactNode) {
  if (!tip) return control;
  return (
    <span className="inline-flex items-center gap-1.5">
      {control}
      <InfoTip text={tip} label={typeof label === "string" ? label : undefined} />
    </span>
  );
}

export function Toggle({
  label,
  isSelected,
  onChange,
  isDisabled,
  description,
  tip,
  className,
  size = "sm",
  ...aria
}: ToggleBase & { size?: "sm" | "md" }) {
  return withTip(
    <Switch
      size={size}
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      className={className}
      {...aria}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label ? <Label className={LABEL}>{label}</Label> : null}
      </Switch.Content>
      {description ? <Description>{description}</Description> : null}
    </Switch>,
    tip,
    label
  );
}

export function CheckField({
  label,
  isSelected,
  onChange,
  isDisabled,
  description,
  tip,
  className,
  isIndeterminate,
  ...aria
}: ToggleBase & { isIndeterminate?: boolean }) {
  return withTip(
    <Checkbox
      isSelected={isSelected}
      isIndeterminate={isIndeterminate}
      onChange={onChange}
      isDisabled={isDisabled}
      className={className}
      {...aria}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {label ? <Label className={LABEL}>{label}</Label> : null}
      </Checkbox.Content>
      {description ? <Description>{description}</Description> : null}
    </Checkbox>,
    tip,
    label
  );
}
