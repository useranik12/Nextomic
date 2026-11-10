"use client";

import { Switch } from "@heroui/react";
import {
  fieldShown,
  UNBINDABLE_FIELD_REASONS,
  type ParamField,
  type ParamRow,
  type Params,
  type ParamValue
} from "@nextomic/schema";
import { useState } from "react";
import {
  ActionButton,
  MultiSelectField,
  SelectField,
  type SelectOption
} from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { BoltInput } from "../../right-panel/bolt-input";
import { TargetParamsInput } from "./target-params-input";
import { PICKER_KINDS, usePickerOptions, type PickerKind } from "./use-picker-options";

type Options = ReturnType<typeof usePickerOptions>;

const labelOf = (field: ParamField) => (field.required ? `${field.label} *` : field.label);

/** A select or switch that can turn into a text field for dynamic data (bolt). */
function Switchable({
  field,
  value,
  onChange,
  children
}: {
  field: ParamField;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const [asText, setAsText] = useState(value.includes("{{"));
  if (asText) {
    return (
      <div className="flex items-end gap-1">
        <BoltInput
          label={labelOf(field)}
          value={value}
          onValueChange={onChange}
          className="flex-1"
        />
        <button
          type="button"
          aria-label="Use a fixed value"
          onClick={() => {
            setAsText(false);
            onChange(field.default ?? "");
          }}
          className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-default-500 hover:bg-default-100"
        >
          <Icon name="ph:x" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        aria-label={`Use dynamic data for ${field.label}`}
        onClick={() => setAsText(true)}
        className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-warning"
      >
        <Icon name="ph:lightning" />
      </button>
    </div>
  );
}

function SingleInput({
  field,
  value,
  onChange,
  options,
  params
}: {
  field: ParamField;
  value: string;
  onChange: (value: string) => void;
  options: Options;
  /** The action's params, for pickers that depend on another field (columns of a table). */
  params: Params;
}) {
  if (PICKER_KINDS.has(field.kind)) {
    const items: SelectOption[] = options.optionsFor(field, params);
    const reason = UNBINDABLE_FIELD_REASONS[field.kind];
    if (field.kind === "supabaseColumns") {
      return (
        <MultiSelectField
          compact
          label={labelOf(field)}
          options={items}
          values={value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)}
          onValuesChange={(values) => onChange(values.join(","))}
          isDisabled={items.length === 0}
          placeholder="All columns"
          description={items.length === 0 ? options.emptyHint(field.kind) : undefined}
        />
      );
    }
    return (
      <SelectField
        compact
        label={labelOf(field)}
        options={items}
        value={value}
        onValueChange={onChange}
        isDisabled={items.length === 0}
        description={items.length === 0 ? options.emptyHint(field.kind as PickerKind) : reason}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <Switchable field={field} value={value} onChange={onChange}>
        <SelectField
          compact
          label={labelOf(field)}
          options={[...(field.options ?? [])]}
          value={value || (field.default ?? "")}
          onValueChange={onChange}
        />
      </Switchable>
    );
  }
  if (field.kind === "boolean") {
    return (
      <Switchable field={field} value={value} onChange={onChange}>
        <Switch
          size="sm"
          isSelected={(value || field.default) === "true"}
          onValueChange={(on) => onChange(on ? "true" : "false")}
        >
          <span className="text-small">{field.label}</span>
        </Switch>
      </Switchable>
    );
  }
  return (
    <BoltInput
      label={labelOf(field)}
      value={value}
      onValueChange={onChange}
      placeholder={field.placeholder ?? field.default}
      inputMode={field.kind === "number" ? "decimal" : undefined}
    />
  );
}

function RowsInput({
  field,
  rows,
  onChange,
  options,
  params
}: {
  field: ParamField;
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
  options: Options;
  params: Params;
}) {
  const columns = field.columns ?? [];
  const blank = () => Object.fromEntries(columns.map((c) => [c.key, c.default ?? ""])) as ParamRow;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small font-medium text-default-700">{labelOf(field)}</legend>
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2 rounded-medium border border-divider p-2">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
            {columns.map((column) => (
              <SingleInput
                key={column.key}
                field={column}
                value={row[column.key] ?? ""}
                options={options}
                params={params}
                onChange={(v) =>
                  onChange(rows.map((r, j) => (j === i ? { ...r, [column.key]: v } : r)))
                }
              />
            ))}
          </div>
          <button
            type="button"
            aria-label={`Remove ${field.label} row ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-danger"
          >
            <Icon name="ph:trash" />
          </button>
        </div>
      ))}
      <ActionButton
        size="sm"
        tone="ghost"
        startContent={<Icon name="ph:plus" />}
        onPress={() => onChange([...rows, blank()])}
      >
        Add row
      </ActionButton>
    </fieldset>
  );
}

/** Every field on screen for these params, with help tips. */
export function ParamFields({
  fields,
  params,
  onChange
}: {
  fields: readonly ParamField[];
  params: Params;
  onChange: (params: Params) => void;
}) {
  const options = usePickerOptions();
  const set = (key: string, value: ParamValue) => {
    const next: Params = { ...params, [key]: value };
    // A new page or template has other parameters: values for the old one are dropped.
    for (const f of fields)
      if (f.kind === "targetParams" && f.targetParam === key) next[f.key] = [];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {fields
        .filter((f) => fieldShown(f, params, fields))
        .map((field) => {
          const value = params[field.key];
          return (
            <div key={field.key} className="flex flex-col gap-1">
              {field.kind === "targetParams" ? (
                <TargetParamsInput
                  field={field}
                  sourceKind={
                    fields.find((f) => f.key === field.targetParam)?.kind === "page"
                      ? "page"
                      : "template"
                  }
                  params={params}
                  rows={Array.isArray(value) ? value : []}
                  onChange={(rows) => set(field.key, rows)}
                />
              ) : field.kind === "rows" ? (
                <RowsInput
                  field={field}
                  rows={Array.isArray(value) ? value : []}
                  options={options}
                  params={params}
                  onChange={(rows) => set(field.key, rows)}
                />
              ) : (
                <SingleInput
                  field={field}
                  value={typeof value === "string" ? value : ""}
                  options={options}
                  params={params}
                  onChange={(v) => set(field.key, v)}
                />
              )}
              {field.help ? <p className="text-tiny text-default-500">{field.help}</p> : null}
            </div>
          );
        })}
    </div>
  );
}
