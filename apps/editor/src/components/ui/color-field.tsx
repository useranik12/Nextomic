"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui-v2/react";
import { parseColor, toHex } from "@nextomic/schema";
import { useState } from "react";
import { ColorPicker } from "./color-picker";

const CHECKER =
  "bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:8px_8px]";

/**
 * A color value with its swatch: the swatch opens the picker, the text stays editable (a hex, an
 * rgb()/hsl() value, a var() reference or any CSS color). `display` is the color to show when the
 * value is a reference the picker cannot read.
 */
export function ColorField({
  label,
  value,
  onChange,
  display,
  className
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  display?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const shown = parseColor(value) ?? (display ? parseColor(display) : null);
  return (
    <div
      className={`flex h-8 min-w-0 items-center gap-2 rounded-full border border-default-200 pl-1.5 pr-3 focus-within:border-default-800 ${className ?? ""}`}
    >
      <Popover isOpen={open} onOpenChange={setOpen} placement="bottom-start">
        <PopoverTrigger>
          <button
            type="button"
            aria-label={`Open the color picker for ${label}`}
            className={`relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-divider ${CHECKER}`}
          >
            <span
              className="absolute inset-0"
              style={{ background: shown ? toHex(shown) : "transparent" }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-3">
          <ColorPicker value={value} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <input
        aria-label={label}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent font-mono text-small outline-none"
      />
    </div>
  );
}
