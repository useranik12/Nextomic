"use client";

import { FormInput, SelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";

// Settings both query types share: Single Row or List of Rows, the list's limit, and infinite
// scroll (lists only).

const SHAPES = [
  { value: "list", label: "List of Rows" },
  { value: "single", label: "Single Row" }
];

export interface RowSettingsValue {
  single: boolean;
  limit: number;
  infiniteScroll: boolean;
}

export function RowSettings({
  value,
  onChange
}: {
  value: RowSettingsValue;
  onChange: (patch: Partial<RowSettingsValue>) => void;
}) {
  return (
    <>
      <SelectField
        compact
        label="Rows"
        options={SHAPES}
        value={value.single ? "single" : "list"}
        onValueChange={(shape) => onChange({ single: shape === "single" })}
      />
      {value.single ? null : (
        <>
          <FormInput
            compact
            type="number"
            label="Limit"
            description="How many rows to load at a time (1 to 1000)."
            min={1}
            max={1000}
            value={String(value.limit)}
            onValueChange={(text) => {
              const limit = Math.round(Number(text));
              if (Number.isFinite(limit)) onChange({ limit: Math.min(1000, Math.max(1, limit)) });
            }}
          />
          <SwitchRow
            label="Infinite scroll"
            tip="Loads the next rows when 90% of the loaded rows have been viewed."
            selected={value.infiniteScroll}
            onChange={(infiniteScroll) => onChange({ infiniteScroll })}
          />
        </>
      )}
    </>
  );
}
