"use client";

import { FIELD_OPTION_WARN, type BindKey } from "@nextomic/schema";
import { FormInput, SelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { BoltInput } from "../right-panel/bolt-input";
import { useQueryFormMode } from "./query-form-mode";

// Settings every query type shares: Single Row or List of Rows, the list's limit, the rows skipped
// from the start (where a page begins) and, for Supabase, infinite scroll. In a Refresh Query the
// limit and the skip also take dynamic data (`bind`), so a page can be chosen from a variable.

const SHAPES = [
  { value: "list", label: "List of Rows" },
  { value: "single", label: "Single Row" }
];

export interface RowSettingsValue {
  single: boolean;
  limit: number;
  offset: number;
  infiniteScroll?: boolean;
}

/** A whole number setting; in a Refresh Query a {{ tag }} typed or picked here is bound instead. */
function CountField({
  label,
  tip,
  description,
  min,
  max,
  value,
  bindKey,
  onNumber
}: {
  label: string;
  tip: string | undefined;
  description: string;
  min: number;
  max: number;
  value: number;
  bindKey: BindKey;
  onNumber: (n: number) => void;
}) {
  const mode = useQueryFormMode();
  const setNumber = (text: string) => {
    const n = Math.round(Number(text));
    if (text.trim() !== "" && Number.isFinite(n)) onNumber(Math.min(max, Math.max(min, n)));
  };
  if (mode.bind) {
    const bound = mode.bind.get(bindKey);
    return (
      <BoltInput
        serverRun={mode.serverRun}
        label={label}
        tip={tip}
        description={`${description} A {{ tag }} is filled when the action runs.`}
        value={bound || String(value)}
        onValueChange={(text) => {
          if (text.includes("{{")) return mode.bind?.set(bindKey, text);
          if (bound) mode.bind?.set(bindKey, "");
          setNumber(text);
        }}
      />
    );
  }
  return (
    <FormInput
      compact
      type="number"
      label={label}
      tip={tip}
      description={description}
      min={min}
      max={max}
      value={String(value)}
      onValueChange={setNumber}
    />
  );
}

export function RowSettings({
  value,
  onChange
}: {
  value: RowSettingsValue;
  onChange: (patch: Partial<RowSettingsValue>) => void;
}) {
  const mode = useQueryFormMode();
  return (
    <>
      {mode.field ? null : (
        <SelectField
          compact
          label="Rows"
          tip={mode.tip("rows")}
          options={SHAPES}
          value={value.single ? "single" : "list"}
          onValueChange={(shape) => onChange({ single: shape === "single" })}
        />
      )}
      {value.single ? null : (
        <CountField
          label="Limit"
          tip={mode.tip("limit")}
          description={
            mode.field
              ? value.limit > FIELD_OPTION_WARN
                ? `Only the first ${value.limit} rows become options. Over ${FIELD_OPTION_WARN} options are hard to scan: use a searchable Select instead.`
                : `Only the first ${value.limit} rows become options (1 to 1000).`
              : "How many rows to load at a time (1 to 1000)."
          }
          min={1}
          max={1000}
          value={value.limit}
          bindKey="limit"
          onNumber={(limit) => onChange({ limit })}
        />
      )}
      <CountField
        label="Skip"
        tip={mode.tip("offset")}
        description="Rows to skip from the start of the list: the first row of a page is Skip + 1."
        min={0}
        max={100_000}
        value={value.offset}
        bindKey="offset"
        onNumber={(offset) => onChange({ offset })}
      />
      {value.single || value.infiniteScroll === undefined || mode.field ? null : (
        <SwitchRow
          label="Infinite scroll"
          tip={
            mode.tip("infiniteScroll") ??
            "Loads the next rows when 90% of the loaded rows have been viewed."
          }
          disabled={mode.refresh}
          selected={value.infiniteScroll}
          onChange={(infiniteScroll) => onChange({ infiniteScroll })}
        />
      )}
    </>
  );
}
