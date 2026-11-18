"use client";

import { FormInput, SelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { FIELD_OPTION_WARN } from "@nextomic/schema";
import { useQueryFormMode } from "./query-form-mode";

// Settings both query types share: Single Row or List of Rows and the list's limit. Infinite scroll
// (lists only) shows only for types that support it (Supabase; REST waits for paged APIs).

const SHAPES = [
  { value: "list", label: "List of Rows" },
  { value: "single", label: "Single Row" }
];

export interface RowSettingsValue {
  single: boolean;
  limit: number;
  infiniteScroll?: boolean;
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
        <>
          <FormInput
            compact
            type="number"
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
            value={String(value.limit)}
            onValueChange={(text) => {
              const limit = Math.round(Number(text));
              if (Number.isFinite(limit)) onChange({ limit: Math.min(1000, Math.max(1, limit)) });
            }}
          />
          {value.infiniteScroll === undefined || mode.field ? null : (
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
      )}
    </>
  );
}
