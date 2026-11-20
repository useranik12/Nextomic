"use client";

import { tagText, type QueryOrder, type SupabaseColumn } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { BoltInput } from "../right-panel/bolt-input";
import { DynamicBolt } from "../right-panel/dynamic-bolt";
import { useQueryFormMode } from "./query-form-mode";
import { RemoveRowButton } from "./remove-row-button";

const DIRECTIONS = [
  { value: "asc", label: "Increasing" },
  { value: "desc", label: "Decreasing" }
];

/**
 * A fixed choice that, in a Refresh Query's first Order by row, can instead be filled from dynamic
 * data (a Select's value picks the sort): a {{ tag }} turns it into a text field.
 */
function BindableSelect({
  bindKey,
  label,
  tip,
  options,
  value,
  onValueChange
}: {
  bindKey: "orderColumn" | "orderDirection";
  label: string;
  tip: string | undefined;
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const mode = useQueryFormMode();
  const bound = mode.bind?.get(bindKey) ?? "";
  if (mode.bind && bound.includes("{{")) {
    return (
      <BoltInput
        serverRun={mode.serverRun}
        label={label}
        tip={tip}
        placeholder={bindKey === "orderColumn" ? "{{ form.sort.column }}" : "asc or desc"}
        value={bound}
        onValueChange={(text) => mode.bind?.set(bindKey, text)}
      />
    );
  }
  return (
    <div className="flex items-end gap-1">
      <SelectField
        compact
        className="min-w-0 flex-1"
        label={label}
        tip={tip}
        options={options}
        value={value}
        onValueChange={onValueChange}
      />
      {mode.bind ? (
        <span className="flex h-8 items-center">
          <DynamicBolt
            serverRun={mode.serverRun}
            label={label}
            onInsert={(token) => mode.bind?.set(bindKey, tagText(token))}
          />
        </span>
      ) : null}
    </div>
  );
}

/** One Order by row: a column and its direction. */
export function QueryOrderRow({
  order,
  columns,
  bindable = false,
  onChange
}: {
  order: QueryOrder;
  columns: SupabaseColumn[];
  /** The first row of a Refresh Query: its column and direction take dynamic data. */
  bindable?: boolean;
  onChange: (next: QueryOrder | null) => void;
}) {
  const mode = useQueryFormMode();
  const columnOptions = columns.map((c) => ({ value: c.name, label: c.name }));
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {bindable ? (
            <BindableSelect
              bindKey="orderColumn"
              label="Column"
              tip={mode.tip(`order:${order.id}:column`)}
              options={columnOptions}
              value={order.column}
              onValueChange={(column) => onChange({ ...order, column })}
            />
          ) : (
            <SelectField
              compact
              label="Column"
              tip={mode.tip(`order:${order.id}:column`)}
              options={columnOptions}
              value={order.column}
              onValueChange={(column) => onChange({ ...order, column })}
            />
          )}
        </div>
        <RemoveRowButton label={`Remove order by ${order.column}`} onPress={() => onChange(null)} />
      </div>
      {bindable ? (
        <BindableSelect
          bindKey="orderDirection"
          label="Direction"
          tip={mode.tip(`order:${order.id}:direction`)}
          options={DIRECTIONS}
          value={order.ascending ? "asc" : "desc"}
          onValueChange={(dir) => onChange({ ...order, ascending: dir === "asc" })}
        />
      ) : (
        <SelectField
          compact
          label="Direction"
          tip={mode.tip(`order:${order.id}:direction`)}
          options={DIRECTIONS}
          value={order.ascending ? "asc" : "desc"}
          onValueChange={(dir) => onChange({ ...order, ascending: dir === "asc" })}
        />
      )}
    </div>
  );
}
