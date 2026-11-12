"use client";

import type { QueryOrder, SupabaseColumn } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { useQueryFormMode } from "./query-form-mode";
import { RemoveRowButton } from "./remove-row-button";

const DIRECTIONS = [
  { value: "asc", label: "Increasing" },
  { value: "desc", label: "Decreasing" }
];

/** One Order by row: a column and its direction. */
export function QueryOrderRow({
  order,
  columns,
  onChange
}: {
  order: QueryOrder;
  columns: SupabaseColumn[];
  onChange: (next: QueryOrder | null) => void;
}) {
  const mode = useQueryFormMode();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-2">
      <div className="flex items-end gap-2">
        <SelectField
          compact
          className="min-w-0 flex-1"
          label="Column"
          tip={mode.tip(`order:${order.id}:column`)}
          options={columns.map((c) => ({ value: c.name, label: c.name }))}
          value={order.column}
          onValueChange={(column) => onChange({ ...order, column })}
        />
        <RemoveRowButton label={`Remove order by ${order.column}`} onPress={() => onChange(null)} />
      </div>
      <SelectField
        compact
        label="Direction"
        tip={mode.tip(`order:${order.id}:direction`)}
        options={DIRECTIONS}
        value={order.ascending ? "asc" : "desc"}
        onValueChange={(dir) => onChange({ ...order, ascending: dir === "asc" })}
      />
    </div>
  );
}
