"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/lib/icons/Icon";
import {
  FILTER_FIELDS,
  TRANSFORM_FIELDS,
  parseCalls,
  readField,
  serializeCalls,
  writeField,
  type CallField
} from "./css-calls";

/**
 * Visual editor for `transform`, `filter` and `backdrop-filter`: a slider and a number box per
 * function. A function back at its neutral value leaves the CSS; functions this editor does not
 * know stay in the text untouched.
 */
export function CallEditorButton({
  label,
  kind,
  value,
  onChange
}: {
  label: string;
  kind: "transform" | "filter" | "backdrop-filter";
  value: string | undefined;
  onChange: (next: string | null) => void;
}) {
  const fields = kind === "transform" ? TRANSFORM_FIELDS : FILTER_FIELDS;
  const calls = parseCalls(value);
  const active = calls !== null && calls.length > 0;

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`Open ${label} editor`}
          title={`${label} editor`}
          className={
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300 hover:bg-default-300 " +
            (active ? "text-warning-600" : "text-body")
          }
        >
          <Icon name="ph:sliders-horizontal" width={16} height={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 items-stretch gap-3 p-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {calls === null ? (
          <p className="text-sm text-body">
            This value uses CSS the editor cannot split into sliders. Edit the text, or clear it to
            start with sliders.
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
            {fields.map((field) => (
              <FieldRow
                key={field.name}
                field={field}
                value={readField(calls, field)}
                onChange={(n) => onChange(serializeCalls(writeField(calls, field, n)))}
              />
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start rounded-xl px-2 py-1 text-sm text-body hover:bg-default hover:text-foreground"
        >
          Clear all
        </button>
      </PopoverContent>
    </Popover>
  );
}

function FieldRow({
  field,
  value,
  onChange
}: {
  field: CallField;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const shown = value ?? field.neutral;
  return (
    <li className="flex flex-col gap-1">
      <span className="text-xs font-medium text-body">{field.label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={`${field.label} slider`}
          min={field.min}
          max={field.max}
          step={field.step}
          value={Math.min(field.max, Math.max(field.min, shown))}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ background: field.track }}
          className="h-2.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full ring-1 ring-inset ring-default-300 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-focus [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-focus [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
        <input
          type="number"
          aria-label={field.label}
          min={field.min}
          max={field.max}
          step={field.step}
          value={shown}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-8 w-16 rounded-xl bg-default px-2 text-right text-sm text-foreground outline-none focus:bg-default-hover focus:ring-1 focus:ring-focus/30"
        />
        <span className="w-7 text-xs text-muted">{field.unit}</span>
      </div>
    </li>
  );
}
