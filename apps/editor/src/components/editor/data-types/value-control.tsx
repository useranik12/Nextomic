"use client";

import { checkStateValue, type TypeRegistry, type TypeSpec } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { SelectField } from "@/components/ui/controls";
import { ColorField } from "@/components/ui/color-field";
import { FormatButton } from "@/components/ui/format-button";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";

// A text box that can be dragged taller: no fixed or !important height (the browser's drag sets an
// inline height, which an !important class would override).
const AREA_CLASS =
  "block w-full min-h-8 resize-y rounded-large border border-default-200 bg-transparent px-3 py-1.5 pr-9 font-mono text-tiny leading-5 text-foreground outline-none transition-colors placeholder:text-default-400 hover:border-default-400 focus:border-default-800 focus:ring-1 focus:ring-default-800/10";

const JSON_TYPES = new Set(["json", "dataType", "supabaseRow"]);

/** "+05:30" for the browser's offset at that moment. */
function offsetOf(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="mt-0.5 px-2 text-tiny text-danger">
      {text}
    </p>
  ) : null;
}

/** JSON, data type values, rows and lists: a resizable box with the Format icon. */
function JsonArea({
  label,
  value,
  placeholder,
  invalid,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) {
  const lines = Math.min(Math.max(value.split("\n").length, 1), 8);
  return (
    <div className="relative min-w-0">
      <textarea
        aria-label={label}
        aria-invalid={invalid}
        rows={lines}
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${AREA_CLASS} ${invalid ? "border-danger" : ""}`}
      />
      {value.trim() ? (
        <span className="absolute right-1.5 top-1">
          <FormatButton
            code={value}
            language="json"
            onFormatted={onChange}
            label={`Format ${label}`}
          />
        </span>
      ) : null}
    </div>
  );
}

/** A timestamp as text (timestamptz or timestamp) with a picker that fills in the local zone. */
function TimestampInput({
  label,
  value,
  invalid,
  onChange
}: {
  label: string;
  value: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="relative min-w-0">
      <input
        aria-label={label}
        aria-invalid={invalid}
        placeholder="2026-01-31T09:30:00+00:00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${compactFieldClass} pr-9 font-mono ${invalid ? "!border-danger" : ""}`}
      />
      <button
        type="button"
        aria-label={`Pick a date and time for ${label}`}
        onClick={() => picker.current?.showPicker()}
        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
      >
        <Icon name="ph:calendar-blank" width={14} height={14} />
      </button>
      <input
        ref={picker}
        type="datetime-local"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        onChange={(e) => {
          if (!e.target.value) return;
          const at = new Date(e.target.value);
          onChange(`${e.target.value}:00${offsetOf(at)}`);
        }}
      />
    </div>
  );
}

/**
 * The value of a state variable or constant, with a control that fits its type: True/False for
 * Boolean, the color picker for Color, a timestamp field with a picker, the enum's values, and a
 * resizable JSON box (with Format) for JSON, data types, rows and lists. Text that does not fit
 * the type shows the reason and is not saved until it is fixed.
 */
export function ValueControl({
  label,
  spec,
  registry,
  value,
  onChange
}: {
  label: string;
  spec: TypeSpec;
  registry: TypeRegistry;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const problem = checkStateValue(spec, draft, registry);
  const commit = (next: string) => {
    setDraft(next);
    if (checkStateValue(spec, next, registry) === null) onChange(next);
  };

  if (spec.isList || JSON_TYPES.has(spec.type))
    return (
      <div className="min-w-0">
        <JsonArea
          label={label}
          value={draft}
          invalid={Boolean(problem)}
          placeholder={spec.isList ? '["first", "second"]' : '{ "key": "value" }'}
          onChange={commit}
        />
        <Problem text={problem} />
      </div>
    );
  if (spec.type === "boolean" || spec.type === "enum") {
    const values =
      spec.type === "boolean"
        ? [
            { value: "true", label: "True" },
            { value: "false", label: "False" }
          ]
        : (registry.enums.find((e) => e.id === spec.ref)?.values ?? []).map((v) => ({
            value: v,
            label: v
          }));
    if (spec.type === "enum" && values.length === 0)
      return <p className="px-2 text-tiny text-default-500">Choose an enum that has values.</p>;
    return (
      <SelectField
        compact
        hideLabel
        label={label}
        value={draft === "" ? "none" : draft}
        onValueChange={(v) => commit(v === "none" ? "" : v)}
        options={[{ value: "none", label: "No value" }, ...values]}
      />
    );
  }
  if (spec.type === "color")
    return (
      <div className="min-w-0">
        <ColorField label={label} value={draft} onChange={commit} />
        <Problem text={problem} />
      </div>
    );
  if (spec.type === "timestamptz")
    return (
      <div className="min-w-0">
        <TimestampInput label={label} value={draft} invalid={Boolean(problem)} onChange={commit} />
        <Problem text={problem} />
      </div>
    );
  return (
    <div className="min-w-0">
      <input
        aria-label={label}
        aria-invalid={Boolean(problem)}
        inputMode={spec.type === "number" ? "decimal" : undefined}
        type={spec.type === "url" ? "url" : "text"}
        placeholder={
          spec.type === "number" ? "0" : spec.type === "url" ? "https://… or /path" : "Text"
        }
        value={draft}
        onChange={(e) => commit(e.target.value)}
        className={`${compactFieldClass} ${problem ? "!border-danger" : ""}`}
      />
      <Problem text={problem} />
    </div>
  );
}
