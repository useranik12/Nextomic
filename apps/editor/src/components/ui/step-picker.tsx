"use client";

import { useId } from "react";
import { InfoTip } from "./info-tip";

/**
 * Picks one of a few fixed steps, such as an image quality of 40, 50, 60, 70 or 80 percent. A
 * radio group (arrow keys move, Tab leaves), so it works without a pointer.
 */
export function StepPicker<T extends number>({
  label,
  tip,
  steps,
  value,
  suffix = "%",
  isDisabled = false,
  onChange
}: {
  label: string;
  tip: string;
  steps: readonly T[];
  value: T;
  suffix?: string;
  isDisabled?: boolean;
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  const move = (index: number) => {
    const next = steps[Math.min(steps.length - 1, Math.max(0, index))];
    if (next !== undefined) onChange(next);
  };
  return (
    <div className={`flex flex-col gap-1.5 ${isDisabled ? "opacity-60" : ""}`}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span id={labelId}>{label}</span>
        <InfoTip text={tip} label={label} />
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-disabled={isDisabled}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const selected = step === value;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${step}${suffix}`}
              disabled={isDisabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(step)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  move(index + 1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(index - 1);
                }
              }}
              className={`h-8 cursor-pointer rounded-md border text-xs outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed ${
                selected
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border bg-transparent text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {step}
              {suffix}
            </button>
          );
        })}
      </div>
    </div>
  );
}
