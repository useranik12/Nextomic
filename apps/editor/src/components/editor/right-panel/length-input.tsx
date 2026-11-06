"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useEffect, useState } from "react";
import { previewProps, useStylePreview } from "./design-field-tools";
import { isNumberText, lengthMode, parseLength, unitSpecFor, type UnitSpec } from "./length-units";

const SILENT_PREVIEW = { show: () => undefined, clear: () => undefined };

const TRIGGER =
  "flex shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-tiny font-medium text-default-600 transition-colors duration-300 hover:bg-default-300 hover:text-foreground focus-visible:ring-1 focus-visible:ring-default-800/40";

/** The unit a fresh field starts with: a plain number where that is the usual choice (line-height). */
function defaultUnit(spec: UnitSpec | null): string {
  if (!spec) return "";
  return spec.unitless && spec.units.length > 0 ? "" : (spec.units[0] ?? "");
}

/** Arrow-key step: 1, or 0.1 for small unitless numbers and em/rem; Shift is 10x, Alt is 0.1x. */
function stepSize(property: string, unit: string, shift: boolean, alt: boolean): number {
  const fine =
    property === "opacity" || (unit === "" && property !== "z-index" && property !== "order");
  const base = fine || unit === "em" || unit === "rem" ? 0.1 : 1;
  return shift ? base * 10 : alt ? base / 10 : base;
}

/** The text of `current` moved by `direction * step`, without float noise, never below 0 when negatives are not allowed. */
function stepNumber(current: string, direction: 1 | -1, step: number, negative: boolean): string {
  const parsed = Number.parseFloat(current);
  const from = Number.isFinite(parsed) ? parsed : 0;
  let next = Math.round((from + direction * step) * 1000) / 1000;
  if (!negative && next < 0) next = 0;
  return String(next);
}

/**
 * A length or number value the safe way: the user types the number, picks the unit (px, rem, em, %,
 * vw, dvh ...) or a word (auto, none, fit-content), and Custom takes any CSS text such as calc() or
 * min(1440px, 92%). Letters never end up in the number box.
 */
export function LengthInput({
  property,
  value,
  placeholder,
  ariaLabel,
  id,
  onChange,
  compact,
  noPreview,
  fieldClass
}: {
  property: string;
  value: string | undefined;
  /** Shown while nothing is set: the inherited value or a hint. */
  placeholder?: string | undefined;
  ariaLabel: string;
  id?: string;
  onChange: (next: string | null) => void;
  /** Smaller, for the cells of the box editor. */
  compact?: boolean;
  /** Settings that are not a style of the selected element: hovering a unit shows no canvas preview. */
  noPreview?: boolean;
  /** Classes for the input. */
  fieldClass: string;
}) {
  const spec = unitSpecFor(property);
  const shape = spec ? lengthMode(value, spec) : { mode: "custom" as const, amount: "", unit: "" };
  const [custom, setCustom] = useState(false);
  const [unit, setUnit] = useState(shape.unit || defaultUnit(spec));
  const [text, setText] = useState(shape.amount);
  const [open, setOpen] = useState(false);
  const stylePreview = useStylePreview(property);
  const preview = noPreview ? SILENT_PREVIEW : stylePreview;

  // Follow the stored value when it changes from outside (reset, undo, another element).
  useEffect(() => {
    if (shape.mode === "number") {
      setText(shape.amount);
      setUnit(shape.unit);
    } else if (shape.mode === "empty") setText((t) => (/^-?\.?$/.test(t) && t !== "" ? t : ""));
    if (shape.mode !== "custom") setCustom(false);
  }, [value]);

  if (!spec) return null;
  const forcedCustom = custom || shape.mode === "custom";
  const hint = parseLength(placeholder)?.amount ?? "";

  function commit(raw: string, nextUnit: string) {
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") return onChange(null);
    onChange(`${raw}${nextUnit}`);
  }

  function pickUnit(next: string) {
    preview.clear();
    setCustom(false);
    setUnit(next);
    setOpen(false);
    commit(shape.mode === "number" ? shape.amount : text, next);
  }

  function pickKeyword(word: string) {
    preview.clear();
    setCustom(false);
    setText("");
    setOpen(false);
    onChange(word);
  }

  const triggerLabel =
    shape.mode === "keyword" ? shape.unit : forcedCustom ? "custom" : unit === "" ? "num" : unit;
  const sample = shape.mode === "number" ? shape.amount : text || hint || "0";

  return (
    <div className={"flex min-w-0 items-center " + (compact ? "gap-0.5" : "")}>
      {forcedCustom ? (
        <input
          id={id}
          aria-label={`${ariaLabel} (custom value)`}
          value={shape.mode === "custom" ? (value ?? "") : text}
          placeholder="calc(), min(), var() …"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value.trim() === "" ? null : e.target.value);
          }}
          className={fieldClass + " font-mono"}
        />
      ) : shape.mode === "keyword" ? (
        <input
          id={id}
          aria-label={ariaLabel}
          value={shape.unit}
          autoComplete="off"
          onChange={(e) => {
            // Typing over a word (auto, none) starts a number in the usual unit at once.
            const typed = e.target.value.replace(shape.unit, "");
            if (typed !== "" && isNumberText(typed, spec)) {
              const start = unit || defaultUnit(spec);
              setUnit(start);
              setText(typed);
              commit(typed, start);
            } else onChange(null);
          }}
          className={fieldClass + " text-default-600"}
        />
      ) : (
        <input
          id={id}
          aria-label={ariaLabel}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={hint}
          onChange={(e) => {
            const next = e.target.value;
            if (!isNumberText(next, spec)) return;
            setText(next);
            commit(next, unit);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const next = stepNumber(
              text !== "" ? text : hint,
              e.key === "ArrowUp" ? 1 : -1,
              stepSize(property, unit, e.shiftKey, e.altKey),
              spec.negative
            );
            setText(next);
            commit(next, unit);
          }}
          className={fieldClass}
        />
      )}
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
            aria-label={`Unit for ${ariaLabel}`}
            title="Choose a unit"
            className={TRIGGER + (compact ? " h-5" : " h-6")}
          >
            {triggerLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 items-stretch gap-1 p-2">
          <p className="px-1 text-tiny text-default-500">Unit (hover to preview)</p>
          <ul className="grid grid-cols-2 gap-1">
            {spec.unitless ? (
              <UnitRow
                label="number"
                shown={sample}
                active={shape.mode === "number" && shape.unit === ""}
                onPick={() => pickUnit("")}
                handlers={previewProps(preview, sample)}
              />
            ) : null}
            {spec.units.map((u) => (
              <UnitRow
                key={u}
                label={u}
                shown={`${sample}${u}`}
                active={shape.mode === "number" && shape.unit === u}
                onPick={() => pickUnit(u)}
                handlers={previewProps(preview, `${sample}${u}`)}
              />
            ))}
          </ul>
          {spec.keywords.length > 0 ? (
            <ul className="flex flex-wrap gap-1 border-t border-divider pt-2">
              {spec.keywords.map((word) => (
                <li key={word}>
                  <button
                    type="button"
                    onClick={() => pickKeyword(word)}
                    {...previewProps(preview, word)}
                    aria-pressed={value === word}
                    className={
                      "rounded-full px-2 py-0.5 font-mono text-tiny hover:bg-default-200 " +
                      (value === word ? "bg-default-300" : "bg-default-100")
                    }
                  >
                    {word}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => {
              preview.clear();
              setCustom(true);
              setOpen(false);
            }}
            aria-pressed={forcedCustom}
            className={
              "mt-1 rounded-medium border-t border-divider px-2 pt-2 text-left text-small hover:text-foreground " +
              (forcedCustom ? "font-medium text-foreground" : "text-default-600")
            }
          >
            Custom (calc, min, max, var …)
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function UnitRow({
  label,
  shown,
  active,
  onPick,
  handlers
}: {
  label: string;
  shown: string;
  active: boolean;
  onPick: () => void;
  handlers: ReturnType<typeof previewProps>;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        {...handlers}
        aria-pressed={active}
        className={
          "flex w-full items-center justify-between gap-2 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-default-100 " +
          (active ? "bg-default-200" : "")
        }
      >
        <span className="font-mono text-small">{label}</span>
        <span className="truncate font-mono text-tiny text-default-500">{shown}</span>
      </button>
    </li>
  );
}
