"use client";

import { Switch } from "@heroui/react";
import {
  stateNameProblem,
  valueAfterTypeChange,
  type AppStateVariable,
  type Constant,
  type StateType
} from "@nextomic/schema";
import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";
import { RowDetails } from "./row-details";
import { describePlaces, type UsagePlace } from "./use-state-usage";
import { TypePicker, useTypeRegistry } from "../data-types/type-picker";
import { ValueControl } from "../data-types/value-control";

export type StateRowVariable =
  | { kind: "app"; variable: AppStateVariable }
  | { kind: "const"; variable: Constant };

export const ROW_GRID = {
  app: "grid-cols-[minmax(10rem,1.4fr)_11rem_7rem_minmax(10rem,1.6fr)_4.5rem_2rem_2rem]",
  const: "grid-cols-[minmax(10rem,1.4fr)_11rem_7rem_minmax(10rem,1.6fr)_minmax(8rem,1fr)_2rem_2rem]"
} as const;

/** Name input: commits a valid, free name on blur or Enter; shows why a name is refused. */
function NameCell({
  value,
  taken,
  onCommit
}: {
  value: string;
  taken: string[];
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const problem = draft === value ? null : stateNameProblem(draft, taken);
  const commit = () => {
    if (draft === value) return;
    if (problem) setDraft(value);
    else onCommit(draft);
  };
  return (
    <div className="min-w-0">
      <input
        aria-label="Variable name"
        aria-invalid={Boolean(problem)}
        value={draft}
        onChange={(e) => setDraft(e.target.value.trim())}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(value);
        }}
        className={`${compactFieldClass} font-mono ${problem ? "!border-danger" : ""}`}
      />
      {problem ? (
        <p role="alert" className="mt-0.5 px-2 text-tiny text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** One App State variable or Constant as a table row, with expandable details. */
export function StateRow({
  row,
  taken,
  places,
  onChange,
  onRename,
  onDelete
}: {
  row: StateRowVariable;
  taken: string[];
  places: UsagePlace[];
  onChange: (next: StateRowVariable["variable"]) => void;
  onRename: (to: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const v = row.variable;
  const valueKey = row.kind === "app" ? "defaultValue" : "value";
  const value = row.kind === "app" ? row.variable.defaultValue : row.variable.value;
  const registry = useTypeRegistry();

  function changeShape(type: StateType, isList: boolean, ref: string) {
    if (places.length > 0 && (type !== v.type || isList !== v.isList || ref !== v.ref)) {
      const ok = window.confirm(
        `"${v.name}" is used in: ${describePlaces(places)}. Changing its type can make those bindings show the wrong value. Change it?`
      );
      if (!ok) return;
    }
    onChange({
      ...v,
      type,
      isList,
      ref,
      [valueKey]: valueAfterTypeChange(value, { type, isList, ref }, registry)
    });
  }

  return (
    <li className="border-b border-divider last:border-b-0">
      <div className={`grid ${ROW_GRID[row.kind]} items-start gap-2 py-2`}>
        <NameCell value={v.name} taken={taken} onCommit={onRename} />
        <TypePicker
          label={`Type of ${v.name}`}
          spec={v}
          onChange={(next) => changeShape(next.type, v.isList, next.ref)}
        />
        <SelectField
          compact
          hideLabel
          label={`Is ${v.name} a list`}
          value={v.isList ? "true" : "false"}
          options={[
            { value: "false", label: "False" },
            { value: "true", label: "True" }
          ]}
          onValueChange={(l) => changeShape(v.type, l === "true", v.ref)}
        />
        <ValueControl
          label={row.kind === "app" ? `Default value of ${v.name}` : `Value of ${v.name}`}
          spec={v}
          registry={registry}
          value={value}
          onChange={(next) => onChange({ ...v, [valueKey]: next })}
        />
        {row.kind === "app" ? (
          <div className="flex h-8 items-center">
            <Switch
              size="sm"
              aria-label={`Persist ${v.name}`}
              isSelected={row.variable.persist}
              onValueChange={(persist) => onChange({ ...row.variable, persist })}
            />
          </div>
        ) : (
          <input
            aria-label={`Description of ${v.name}`}
            placeholder="Description"
            value={v.description}
            maxLength={300}
            onChange={(e) => onChange({ ...v, description: e.target.value })}
            className={compactFieldClass}
          />
        )}
        <button
          type="button"
          aria-label={open ? `Hide details of ${v.name}` : `Show details of ${v.name}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
        >
          <Icon
            name="ph:caret-right"
            width={14}
            height={14}
            className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          aria-label={`Delete ${v.name}`}
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-danger transition-colors duration-300 hover:bg-danger/10"
        >
          <Icon name="ph:trash" width={16} height={16} />
        </button>
      </div>
      {open ? <RowDetails row={row} places={places} onChange={onChange} /> : null}
    </li>
  );
}
