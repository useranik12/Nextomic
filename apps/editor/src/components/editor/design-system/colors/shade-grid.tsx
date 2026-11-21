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
import { SwitchField as Switch } from "@/components/ui/toggles";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";

const CHECKER =
  "bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:10px_10px]";

export type ShadeKind = "light" | "dark" | "transparent";

interface Tone {
  /** The color as text in the base color's format; what the chip shows and the picker opens on. */
  text: string;
  /** What the box paints. */
  paint: string;
}

interface Shade extends Tone {
  suffix: string;
  /** The dark mode version, when this group has its own. */
  dark?: Tone;
}

const TARGET = { light: "white", dark: "black", transparent: "transparent" } as const;
/** What a shade is mixed with in dark mode: the mirror of its light mode mix. */
const MIRROR = { light: "black", dark: "white", transparent: "transparent" } as const;

function tone(
  base: string,
  pct: number,
  to: "white" | "black" | "transparent",
  hand?: string
): Tone {
  const text = hand ?? mixedColorText(base, pct, to)?.text ?? colorMix(base, pct, to);
  return { text, paint: text };
}

/**
 * The shades of one group (light, dark or transparent) with their displayed values. With `dualMode`
 * each shade also has its dark mode version: the mirror mix of the base color's dark value.
 */
export function shadesFor(
  kind: ShadeKind,
  base: string,
  options: ColorOptions,
  dualMode = false,
  baseDark = base
): Shade[] {
  const percents =
    kind === "light"
      ? lightPercents(options.lightCount)
      : kind === "dark"
        ? darkPercents(options.darkCount)
        : transparentPercents(options.transparentCount);
  const letter = kind === "light" ? "l" : kind === "dark" ? "d" : "t";
  return percents.map((pct, i) => {
    const suffix = kind === "transparent" ? `t-${pct}` : `${letter}-${i + 1}`;
    const light = tone(base, pct, TARGET[kind], options.overrides[suffix]);
    if (!dualMode) return { suffix, ...light };
    return {
      suffix,
      ...light,
      dark: tone(baseDark, pct, MIRROR[kind], options.darkOverrides[suffix])
    };
  });
}

/** The chip with a value on a box; click copies it. */
function CopyChip({ text, side }: { text: string; side: "left" | "right" | "center" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  const place = side === "center" ? "left-1/2" : side === "left" ? "left-1/4" : "left-3/4";
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${text}`}
      title={copied ? "Copied" : `Copy ${text}`}
      className={`absolute top-1/2 z-10 max-w-[calc(50%-4px)] -translate-x-1/2 -translate-y-1/2 truncate rounded-full bg-black/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white transition-colors duration-300 hover:bg-black/80 focus-visible:ring-1 focus-visible:ring-white ${place} ${side === "center" ? "max-w-[calc(100%-4px)]" : ""}`}
    >
      {copied ? "Copied" : text}
    </button>
  );
}

/** One painted area of a box (the whole box, or its light or dark half) with its own picker. */
function ShadeArea({
  label,
  tone: t,
  overridden,
  onOverride,
  className
}: {
  label: string;
  tone: Tone;
  overridden: boolean;
  onOverride: (value: string | null) => void;
  className: string;
}) {
  return (
    <Popover placement="bottom">
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`Change the shade ${label}`}
          title={`${label}${overridden ? " (set by hand)" : ""}`}
          className={`absolute inset-y-0 overflow-hidden transition-opacity duration-300 hover:opacity-90 focus-visible:ring-1 focus-visible:ring-focus/30 ${className} ${CHECKER}`}
        >
          <span className="absolute inset-0" style={{ background: t.paint }} />
          {overridden ? (
            <span
              aria-hidden
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white shadow ring-1 ring-black/40"
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-2 p-3">
        <p className="font-mono text-xs text-body">{label}</p>
        <ColorPicker value={t.text} onChange={onOverride} />
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
  );
}

function ShadeBox({
  name,
  shade,
  overridden,
  darkOverridden,
  onOverride,
  onDarkOverride
}: {
  name: string;
  shade: Shade;
  overridden: boolean;
  darkOverridden: boolean;
  onOverride: (value: string | null) => void;
  onDarkOverride: (value: string | null) => void;
}) {
  const full = `${name}-${shade.suffix}`;
  return (
    <div className="relative h-[50px] min-w-0 flex-1 overflow-hidden rounded-xl border border-border">
      {shade.dark ? (
        <>
          <ShadeArea
            label={`${full} (light mode)`}
            tone={shade}
            overridden={overridden}
            onOverride={onOverride}
            className="left-0 w-1/2"
          />
          <ShadeArea
            label={`${full} (dark mode)`}
            tone={shade.dark}
            overridden={darkOverridden}
            onOverride={onDarkOverride}
            className="right-0 w-1/2"
          />
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-black/25" />
          <CopyChip text={shade.text} side="left" />
          <CopyChip text={shade.dark.text} side="right" />
        </>
      ) : (
        <>
          <ShadeArea
            label={full}
            tone={shade}
            overridden={overridden}
            onOverride={onOverride}
            className="inset-x-0"
          />
          <CopyChip text={shade.text} side="center" />
        </>
      )}
    </div>
  );
}

/**
 * One group of generated shades as boxes that fill the width, each with its value as a chip. Click
 * a box to pick that shade by hand (the shade then stops following the base color until set back);
 * click the chip to copy the value. When the theme has dark mode, a switch gives the group a dark
 * mode version of every shade: each box is then split, light mode on the left and the generated
 * opposite on the right, each half picked by hand on its own.
 */
export function ShadeRow({
  name,
  kind,
  base,
  baseDark,
  options,
  darkAvailable,
  onDarkMode,
  onOverride,
  onDarkOverride
}: {
  name: string;
  kind: ShadeKind;
  /** The color's value; shades are mixes of it. */
  base: string;
  /** The color's dark mode value, when it has one. */
  baseDark?: string;
  options: ColorOptions;
  /** The theme has dark mode on, so the group can have a dark mode version. */
  darkAvailable: boolean;
  onDarkMode: (on: boolean) => void;
  onOverride: (suffix: string, value: string | null) => void;
  onDarkOverride: (suffix: string, value: string | null) => void;
}) {
  const canSplit = darkAvailable && kind !== "transparent";
  const dual = canSplit && (kind === "light" ? options.lightDarkMode : options.darkDarkMode);
  const shades = shadesFor(kind, base, options, dual, baseDark ?? base);
  return (
    <div className="flex flex-col gap-2">
      {canSplit ? (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-body">
            <Icon name="ph:moon" width={14} height={14} />
            Dark mode version
            <InfoTip text="Makes the opposite of every shade for dark mode, from the dark value of this color: light shades turn dark and dark shades turn light. Each box splits in two, light mode on the left and dark mode on the right. Click either half to choose a color by hand." />
          </p>
          <Switch
            size="sm"
            isSelected={dual}
            onValueChange={onDarkMode}
            aria-label={`Dark mode version of the ${kind} shades of ${name}`}
          />
        </div>
      ) : null}
      <div
        role="group"
        aria-label={`${kind} shades of ${name}`}
        className={dual ? "flex gap-2 rounded-2xl bg-default/60 p-2" : "flex gap-1.5"}
      >
        {shades.map((s) => (
          <ShadeBox
            key={s.suffix}
            name={name}
            shade={s}
            overridden={options.overrides[s.suffix] !== undefined}
            darkOverridden={options.darkOverrides[s.suffix] !== undefined}
            onOverride={(v) => onOverride(s.suffix, v)}
            onDarkOverride={(v) => onDarkOverride(s.suffix, v)}
          />
        ))}
      </div>
      {dual ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Icon name="ph:sun" width={12} height={12} /> Light mode on the left
          <span aria-hidden>·</span>
          <Icon name="ph:moon" width={12} height={12} /> Dark mode on the right
        </p>
      ) : null}
    </div>
  );
}
