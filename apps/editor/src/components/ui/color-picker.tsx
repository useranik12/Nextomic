"use client";

import {
  COLOR_FORMATS,
  detectColorFormat,
  formatColor,
  hslToRgb,
  hsvToRgb,
  parseColor,
  rgbToHsl,
  rgbToHsv,
  toHex,
  type ColorFormat,
  type Hsva
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHECKER =
  "bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:10px_10px]";
const FORMAT_LABEL: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  css: "CSS"
};
const BLACK: Hsva = { h: 0, s: 0, v: 0, a: 1 };

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function toHsva(value: string): Hsva | null {
  const rgba = parseColor(value);
  return rgba ? rgbToHsv(rgba) : null;
}

function NumberBox({
  label,
  value,
  max,
  onChange
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-center text-tiny text-default-500">
      <input
        type="number"
        min={0}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n, 0, max));
        }}
        className="h-8 w-full rounded-medium border-2 border-default-200 bg-transparent px-1 text-center text-small text-foreground outline-none focus:border-default-800"
      />
      {label}
    </label>
  );
}

/**
 * Color picker: saturation/brightness area, hue and alpha sliders, and HEX / RGB / HSL / CSS
 * entry. The value stays text in the format chosen, so a color keeps the way the user writes it.
 */
export function ColorPicker({
  value,
  onChange,
  onFormatChange
}: {
  value: string;
  onChange: (next: string) => void;
  onFormatChange?: (format: ColorFormat) => void;
}) {
  const [format, setFormat] = useState<ColorFormat>(() => detectColorFormat(value));
  const [hsva, setHsva] = useState<Hsva>(() => toHsva(value) ?? BLACK);
  const [cssText, setCssText] = useState(value);
  const area = useRef<HTMLDivElement>(null);
  const emitted = useRef(value);

  // Follow outside changes (another field, undo) without fighting the user's own drags.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const next = toHsva(value);
    if (next) setHsva((cur) => (cur.s === 0 || cur.v === 0 ? { ...next, h: cur.h } : next));
    setCssText(value);
  }, [value]);

  const rgba = useMemo(() => hsvToRgb(hsva), [hsva]);
  const hsl = useMemo(() => rgbToHsl(rgba), [rgba]);

  const commit = useCallback(
    (next: Hsva, nextFormat = format, css = cssText) => {
      setHsva(next);
      const text = formatColor(hsvToRgb(next), nextFormat, nextFormat === "css" ? css : "");
      emitted.current = text;
      setCssText(text);
      onChange(text);
    },
    [format, cssText, onChange]
  );

  function moveArea(clientX: number, clientY: number) {
    const box = area.current?.getBoundingClientRect();
    if (!box) return;
    const s = clamp(((clientX - box.left) / box.width) * 100, 0, 100);
    const v = clamp(100 - ((clientY - box.top) / box.height) * 100, 0, 100);
    commit({ ...hsva, s, v });
  }

  function chooseFormat(next: ColorFormat) {
    setFormat(next);
    onFormatChange?.(next);
    commit(hsva, next, next === "css" ? cssText : "");
  }

  function setRgb(channel: "r" | "g" | "b", n: number) {
    commit(rgbToHsv({ ...rgba, [channel]: n }));
  }

  function setHsl(channel: "h" | "s" | "l", n: number) {
    const next = { ...hsl, [channel]: n };
    const converted = rgbToHsv(hslToRgb(next));
    commit({ ...converted, h: channel === "h" ? n : hsva.h });
  }

  function applyText(text: string) {
    setCssText(text);
    const parsed = toHsva(text);
    if (parsed) setHsva(parsed);
    // Hex, RGB and HSL entry only emits complete colors; CSS entry takes any value (var(), color-mix()).
    if (format !== "css" && !parsed) return;
    emitted.current = text;
    onChange(text);
  }

  const hueColor = `hsl(${hsva.h}, 100%, 50%)`;
  const solid = toHex({ ...rgba, a: 1 });
  const eyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div className="flex w-64 flex-col gap-3">
      <div
        ref={area}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsva.s)} percent, brightness ${Math.round(hsva.v)} percent`}
        aria-valuenow={Math.round(hsva.s)}
        style={{ backgroundColor: hueColor }}
        className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-large focus-visible:ring-2 focus-visible:ring-default-800/40"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveArea(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveArea(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
          const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
          if (!dx && !dy) return;
          e.preventDefault();
          commit({ ...hsva, s: clamp(hsva.s + dx, 0, 100), v: clamp(hsva.v + dy, 0, 100) });
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <span
          aria-hidden
          style={{ left: `${hsva.s}%`, top: `${100 - hsva.v}%`, background: solid }}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-divider ${CHECKER}`}
        >
          <span className="absolute inset-0" style={{ background: toHex(rgba) }} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            type="range"
            min={0}
            max={360}
            value={hsva.h}
            aria-label="Hue"
            onChange={(e) => commit({ ...hsva, h: Number(e.target.value) })}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-default-800 [&::-webkit-slider-thumb]:shadow"
            style={{
              background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
            }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsva.a * 100)}
            aria-label="Alpha"
            onChange={(e) => commit({ ...hsva, a: Number(e.target.value) / 100 })}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-default-800 [&::-webkit-slider-thumb]:shadow"
            style={{
              background: `linear-gradient(to right, transparent, ${solid}), repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%) 0 0/8px 8px`
            }}
          />
        </div>
        {eyeDropper ? (
          <button
            type="button"
            aria-label="Pick a color from the screen"
            className="h-8 w-8 shrink-0 rounded-full text-default-600 hover:bg-default-100"
            onClick={async () => {
              const Picker = (
                window as unknown as {
                  EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
                }
              ).EyeDropper;
              try {
                const picked = await new Picker().open();
                const next = toHsva(picked.sRGBHex);
                if (next) commit({ ...next, a: hsva.a });
              } catch {
                // Dismissed with Escape.
              }
            }}
          >
            ⌖
          </button>
        ) : null}
      </div>

      <div role="group" aria-label="Color format" className="grid grid-cols-4 gap-1">
        {COLOR_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={format === f}
            onClick={() => chooseFormat(f)}
            className={
              "h-7 rounded-full text-tiny font-medium transition-colors duration-300 " +
              (format === f
                ? "bg-default-800 text-default-50"
                : "text-default-600 hover:bg-default-100")
            }
          >
            {FORMAT_LABEL[f]}
          </button>
        ))}
      </div>

      {format === "hex" || format === "css" ? (
        <input
          aria-label={format === "hex" ? "Hex color" : "CSS color"}
          value={cssText}
          spellCheck={false}
          onChange={(e) => applyText(e.target.value)}
          className="h-8 w-full rounded-full border-2 border-default-200 bg-transparent px-3 font-mono text-small outline-none focus:border-default-800"
        />
      ) : null}
      {format === "rgb" ? (
        <div className="flex gap-1.5">
          <NumberBox label="R" value={rgba.r} max={255} onChange={(n) => setRgb("r", n)} />
          <NumberBox label="G" value={rgba.g} max={255} onChange={(n) => setRgb("g", n)} />
          <NumberBox label="B" value={rgba.b} max={255} onChange={(n) => setRgb("b", n)} />
          <NumberBox
            label="A %"
            value={Math.round(hsva.a * 100)}
            max={100}
            onChange={(n) => commit({ ...hsva, a: n / 100 })}
          />
        </div>
      ) : null}
      {format === "hsl" ? (
        <div className="flex gap-1.5">
          <NumberBox
            label="H"
            value={Math.round(hsl.h)}
            max={360}
            onChange={(n) => setHsl("h", n)}
          />
          <NumberBox
            label="S %"
            value={Math.round(hsl.s)}
            max={100}
            onChange={(n) => setHsl("s", n)}
          />
          <NumberBox
            label="L %"
            value={Math.round(hsl.l)}
            max={100}
            onChange={(n) => setHsl("l", n)}
          />
          <NumberBox
            label="A %"
            value={Math.round(hsva.a * 100)}
            max={100}
            onChange={(n) => commit({ ...hsva, a: n / 100 })}
          />
        </div>
      ) : null}
    </div>
  );
}
