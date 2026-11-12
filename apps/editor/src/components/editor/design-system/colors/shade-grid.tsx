"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  colorMix,
  darkPercents,
  lightPercents,
  mixedColorText,
  transparentPercents,
  type ColorOptions
} from "@nextomic/schema";
import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";

const CHECKER =
  "bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:10px_10px]";

export type ShadeKind = "light" | "dark" | "transparent";

interface Shade {
  suffix: string;
  /** The color as text in the base color's format; what the chip shows and the picker opens on. */
  text: string;
  /** What the box paints. */
  paint: string;
}

const TARGET = { light: "white", dark: "black", transparent: "transparent" } as const;

/** The shades of one group (light, dark or transparent) with their displayed values. */
export function shadesFor(kind: ShadeKind, base: string, options: ColorOptions): Shade[] {
  const percents =
    kind === "light"
      ? lightPercents(options.lightCount)
      : kind === "dark"
        ? darkPercents(options.darkCount)
        : transparentPercents(options.transparentCount);
  const letter = kind === "light" ? "l" : kind === "dark" ? "d" : "t";
  return percents.map((pct, i) => {
    const suffix = kind === "transparent" ? `t-${pct}` : `${letter}-${i + 1}`;
    const override = options.overrides[suffix];
    const mixed = mixedColorText(base, pct, TARGET[kind]);
    const text = override ?? mixed?.text ?? colorMix(base, pct, TARGET[kind]);
    return { suffix, text, paint: override ?? mixed?.text ?? colorMix(base, pct, TARGET[kind]) };
  });
}

function ShadeBox({
  name,
  shade,
  overridden,
  onOverride
}: {
  name: string;
  shade: Shade;
  overridden: boolean;
  onOverride: (value: string | null) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shade.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative h-[50px] min-w-0 flex-1">
      <Popover placement="bottom">
        <PopoverTrigger>
          <button
            type="button"
            aria-label={`Change the shade ${name}-${shade.suffix}`}
            title={`${name}-${shade.suffix}${overridden ? " (set by hand)" : ""}`}
            className={`absolute inset-0 overflow-hidden rounded-xl border border-border transition-transform duration-300 hover:scale-[1.04] focus-visible:ring-1 focus-visible:ring-focus/30 ${CHECKER}`}
          >
            <span className="absolute inset-0" style={{ background: shade.paint }} />
            {overridden ? (
              <span
                aria-hidden
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white shadow ring-1 ring-black/40"
              />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="flex flex-col gap-2 p-3">
          <p className="font-mono text-xs text-body">
            {name}-{shade.suffix}
          </p>
          <ColorPicker value={shade.text} onChange={onOverride} />
          {overridden ? (
            <button
              type="button"
              onClick={() => onOverride(null)}
              className="self-start rounded-full bg-default px-3 py-1 text-xs font-medium hover:bg-default-hover"
            >
              Back to the generated shade
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${shade.text}`}
        title={copied ? "Copied" : `Copy ${shade.text}`}
        className="absolute left-1/2 top-1/2 z-10 max-w-[calc(100%-4px)] -translate-x-1/2 -translate-y-1/2 truncate rounded-full bg-black/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white transition-colors duration-300 hover:bg-black/80 focus-visible:ring-1 focus-visible:ring-white"
      >
        {copied ? "Copied" : shade.text}
      </button>
    </div>
  );
}

/**
 * One group of generated shades as boxes that fill the width, each with its value as a chip. Click
 * a box to pick that shade by hand (the shade then stops following the base color until set back);
 * click the chip to copy the value.
 */
export function ShadeRow({
  name,
  kind,
  base,
  options,
  onOverride
}: {
  name: string;
  kind: ShadeKind;
  /** The color's value; shades are mixes of it. */
  base: string;
  options: ColorOptions;
  onOverride: (suffix: string, value: string | null) => void;
}) {
  const shades = shadesFor(kind, base, options);
  return (
    <div role="group" aria-label={`${kind} shades of ${name}`} className="flex gap-1.5">
      {shades.map((s) => (
        <ShadeBox
          key={s.suffix}
          name={name}
          shade={s}
          overridden={options.overrides[s.suffix] !== undefined}
          onOverride={(v) => onOverride(s.suffix, v)}
        />
      ))}
    </div>
  );
}
