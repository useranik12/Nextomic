"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useEffect, useState } from "react";
import { useEditorStore } from "../store/editor-store";

// Small tools that sit beside a Design value: the unit chooser and the color palette. Which tools a
// property gets comes from `fieldKind`, so a tool never shows on a property it cannot fill.

export type FieldKind = "color" | "length" | "font" | "other";

const LENGTH_PROPERTY =
  /^(gap|row-gap|column-gap|width|height|min-width|max-width|min-height|max-height|top|right|bottom|left|inset|margin(-[a-z]+)?|padding(-[a-z]+)?|font-size|letter-spacing|word-spacing|text-indent|line-height|flex-basis|border(-[a-z]+)*-(width|radius)|border-radius|outline-(width|offset)|translate|perspective)$/;

export function fieldKind(property: string): FieldKind {
  if (/(^|-)color$/.test(property) || property === "fill" || property === "stroke") return "color";
  if (property === "font-family") return "font";
  if (LENGTH_PROPERTY.test(property)) return "length";
  return "other";
}

/**
 * Shows a hovered option on the canvas element before it is picked. `show` and `clear` go on an
 * option's hover and focus; the preview also ends when the picker closes or unmounts.
 */
export function useStylePreview(property: string): {
  show: (value: string) => void;
  clear: () => void;
} {
  const set = useEditorStore((s) => s.setStylePreview);
  useEffect(() => () => set(null), [set]);
  return {
    show: (value) => set({ property, value }),
    clear: () => set(null)
  };
}

/** Props that make an option preview itself on hover and keyboard focus. */
export const previewProps = (
  preview: { show: (v: string) => void; clear: () => void },
  value: string
) => ({
  onMouseEnter: () => preview.show(value),
  onMouseLeave: preview.clear,
  onFocus: () => preview.show(value),
  onBlur: preview.clear
});

const BUTTON =
  "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-tiny font-medium text-default-500 transition-colors duration-300 hover:bg-default-300 hover:text-foreground";

// ---- Units -------------------------------------------------------------------------------------

const UNITS = ["px", "rem", "em", "%", "vw", "vh", "vmin", "vmax", "ch", "fr"] as const;
const KEYWORDS = ["auto", "0", "fit-content", "min-content", "max-content"];
const NUMBER = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;

/** The number and unit of a plain length such as `1.5rem`; null for keywords, calc() and variables. */
export function parseLength(value: string | undefined): { amount: string; unit: string } | null {
  const m = NUMBER.exec(value?.trim() ?? "");
  return m ? { amount: m[1] ?? "", unit: m[2] ?? "" } : null;
}

/** The unit button: pick px, rem, em, %, vw, vh ... and see the value it would become. */
export function UnitPicker({
  label,
  property,
  value,
  fallback,
  onPick
}: {
  label: string;
  property: string;
  /** The value set on this element, if any. */
  value: string | undefined;
  /** A hint shown when nothing is set (inherited value or placeholder). */
  fallback: string | undefined;
  onPick: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = useStylePreview(property);
  const current = parseLength(value);
  const amount = (current ?? parseLength(fallback))?.amount ?? "16";

  function pick(next: string) {
    preview.clear();
    onPick(next);
    setOpen(false);
  }

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) preview.clear();
        setOpen(next);
      }}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`Unit for ${label}`}
          title="Choose a unit"
          className={BUTTON + " font-mono"}
        >
          {current ? current.unit || "–" : "px"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 items-stretch gap-1 p-2">
        <p className="px-1 text-tiny text-default-500">Unit (hover to preview)</p>
        <ul className="grid grid-cols-2 gap-1">
          {UNITS.map((unit) => (
            <li key={unit}>
              <button
                type="button"
                onClick={() => pick(`${amount}${unit}`)}
                {...previewProps(preview, `${amount}${unit}`)}
                aria-pressed={current?.unit === unit}
                className={
                  "flex w-full items-center justify-between gap-2 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-default-100 " +
                  (current?.unit === unit ? "bg-default-200" : "")
                }
              >
                <span className="font-mono text-small">{unit}</span>
                <span className="truncate font-mono text-tiny text-default-500">
                  {amount}
                  {unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-1 border-t border-divider pt-2">
          {KEYWORDS.map((keyword) => (
            <li key={keyword}>
              <button
                type="button"
                onClick={() => pick(keyword)}
                {...previewProps(preview, keyword)}
                className="rounded-full bg-default-100 px-2 py-0.5 font-mono text-tiny hover:bg-default-200"
              >
                {keyword}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
