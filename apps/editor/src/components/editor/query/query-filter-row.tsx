"use client";

import {
  operatorsFor,
  SUPABASE_OPERATOR_LABELS,
  type QueryFilter,
  type SupabaseColumn,
  type SupabaseOperator
} from "@nextomic/schema";
import { SelectField, type SelectOption } from "@/components/ui/controls";
import { BoltInput } from "../right-panel/bolt-input";
import { DynamicBolt } from "../right-panel/dynamic-bolt";
import { RemoveRowButton } from "./remove-row-button";

// One filter: a column, an operator that works on the column's type, and a value. The value is a
// select where the column has fixed values (booleans, enums, `is`), otherwise a text field; both
// take dynamic data through the bolt.

const IS_VALUES = ["null", "true", "false"];

/** The fixed values of a filter, or null when it takes free text. */
function choices(column: SupabaseColumn, operator: SupabaseOperator): string[] | null {
  if (operator === "is") return IS_VALUES;
  if (operator !== "eq" && operator !== "neq") return null;
  if (column.type === "boolean") return ["true", "false"];
  return column.enumValues;
}

function placeholderFor(column: SupabaseColumn, operator: SupabaseOperator): string {
  if (operator === "in" || column.isList) return "a, b, c";
  if (column.type === "json") return '{"key": "value"}';
  if (column.type === "int" || column.type === "float") return "A number";
  if (column.type === "timestamptz") return "2026-01-31T09:00:00Z";
  if (operator === "like" || operator === "ilike") return "%text%";
  return "Value";
}

function ValueField({
  filter,
  column,
  onChange
}: {
  filter: QueryFilter;
  column: SupabaseColumn | undefined;
  onChange: (value: string) => void;
}) {
  const fixed = column ? choices(column, filter.operator) : null;
  if (!fixed || filter.value.includes("{{")) {
    return (
      <BoltInput
        label="Value"
        placeholder={column ? placeholderFor(column, filter.operator) : "Value"}
        value={filter.value}
        onValueChange={onChange}
      />
    );
  }
  const options: SelectOption[] = fixed.map((v) => ({ value: v, label: v }));
  return (
    <div className="flex items-end gap-1">
      <SelectField
        compact
        className="min-w-0 flex-1"
        label="Value"
        options={filter.value ? options : [{ value: "", label: "Choose" }, ...options]}
        value={filter.value}
        onValueChange={onChange}
      />
      <span className="flex h-8 items-center">
        <DynamicBolt label="Value" onInsert={(token) => onChange(`{{${token}}}`)} />
      </span>
    </div>
  );
}

export function QueryFilterRow({
  filter,
  columns,
  onChange
}: {
  filter: QueryFilter;
  columns: SupabaseColumn[];
  onChange: (next: QueryFilter | null) => void;
}) {
  const column = columns.find((c) => c.name === filter.column);
  const operators = column ? operatorsFor(column) : [filter.operator];

  const chooseColumn = (name: string) => {
    const next = columns.find((c) => c.name === name);
    const allowed = next ? operatorsFor(next) : [];
    const operator = allowed.includes(filter.operator) ? filter.operator : (allowed[0] ?? "eq");
    onChange({ ...filter, column: name, operator, value: "" });
  };
  const chooseOperator = (operator: SupabaseOperator) =>
    onChange({
      ...filter,
      operator,
      value: operator === "is" ? "null" : filter.operator === "is" ? "" : filter.value
    });

  return (
    <div className="flex flex-col gap-2 rounded-medium border border-divider p-2">
      <div className="flex items-end gap-2">
        <SelectField
          compact
          className="min-w-0 flex-1"
          label="Column"
          options={columns.map((c) => ({ value: c.name, label: `${c.name} (${c.pgType})` }))}
          value={filter.column}
          onValueChange={chooseColumn}
        />
        <RemoveRowButton
          label={`Remove filter on ${filter.column}`}
          onPress={() => onChange(null)}
        />
      </div>
      <SelectField
        compact
        label="Condition"
        options={operators.map((op) => ({ value: op, label: SUPABASE_OPERATOR_LABELS[op] }))}
        value={filter.operator}
        onValueChange={(op) => chooseOperator(op as SupabaseOperator)}
      />
      <ValueField
        filter={filter}
        column={column}
        onChange={(value) => onChange({ ...filter, value })}
      />
    </div>
  );
}
