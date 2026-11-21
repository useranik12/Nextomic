"use client";

import { Icon } from "@/lib/icons/Icon";
import type { Swatch } from "./color-ramps";

export const CHECKER =
  "bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:8px_8px]";

/**
 * One color of the palette. A color with its own dark mode value is split in two: light mode on
 * the left, dark mode on the right (turned round while Inverse is on, since the page then shows
 * the dark value in light mode).
 */
export function ColorSwatch({
  swatch,
  selected,
  inverse,
  onPick,
  onEnter,
  onLeave,
  className = ""
}: {
  swatch: Swatch;
  selected: boolean;
  inverse: boolean;
  onPick: () => void;
  onEnter: () => void;
  onLeave: () => void;
  className?: string;
}) {
  const split = swatch.darkColor !== undefined;
  const left = split && inverse ? swatch.darkColor : swatch.color;
  const right = split && inverse ? swatch.color : swatch.darkColor;
  const label = split
    ? `${swatch.name}, light ${swatch.color}, dark ${swatch.darkColor}`
    : `${swatch.name} ${swatch.color}`;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onPick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={
        "relative block shrink-0 overflow-hidden rounded-lg border border-black/10 transition-shadow duration-300 hover:ring-2 hover:ring-foreground/30 focus-visible:ring-2 focus-visible:ring-focus/50 dark:border-white/15 " +
        CHECKER +
        (selected ? " ring-2 ring-focus" : "") +
        (className ? ` ${className}` : "")
      }
    >
      <span
        aria-hidden
        style={{ background: left }}
        className={split ? "absolute inset-y-0 left-0 w-1/2" : "absolute inset-0"}
      />
      {split ? (
        <>
          <span
            aria-hidden
            style={{ background: right }}
            className="absolute inset-y-0 right-0 w-1/2"
          />
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-black/25" />
        </>
      ) : null}
      {selected ? (
        <Icon
          name="ph:check"
          width={12}
          height={12}
          className="absolute inset-0 m-auto text-white mix-blend-difference"
        />
      ) : null}
    </button>
  );
}
