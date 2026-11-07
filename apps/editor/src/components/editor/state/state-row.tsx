"use client";

import { Switch } from "@heroui/react";
import {
  STATE_TYPES,
  STATE_TYPE_LABELS,
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
import { ValueControl } from "./value-control";

export type StateRowVariable =
  | { kind: "app"; variable: AppStateVariable }
  | { kind: "const"; variable: Constant };

export const ROW_GRID = {
  app: "grid-cols-[minmax(10rem,1.4fr)_9rem_7rem_minmax(10rem,1.6fr)_4.5rem_2rem_2rem]",
  const: "grid-cols-[minmax(10rem,1.4fr)_9rem_7rem_minmax(10rem,1.6fr)_minmax(8rem,1fr)_2rem_2rem]"
} as const;

const TYPE_OPTIONS = STATE_TYPES.map((t) => ({ value: t, label: STATE_TYPE_LABELS[t] }));

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

  function changeShape(type: StateType, isList: boolean) {
    if (places.length > 0 && (type !== v.type || isList !== v.isList)) {
      const ok = window.confirm(
        `"${v.name}" is used in: ${describePlaces(places)}. Changing its type can make those bindings show the wrong value. Change it?`
      );
      if (!ok) return;
    }
    onChange({
      ...v,
      type,
      isList,
      [valueKey]: valueAfterTypeChange(value, type, isList, v.enumOptions)
    });
  }

  return (
    <li className="border-b border-divider last:border-b-0">
      <div className={`grid ${ROW_GRID[row.kind]} items-start gap-2 py-2`}>
        <NameCell value={v.name} taken={taken} onCommit={onRename} />
        <SelectField
          compact
          hideLabel
          label={`Type of ${v.name}`}
          value={v.type}
          options={TYPE_OPTIONS}
          onValueChange={(t) => changeShape(t as StateType, v.isList)}
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
          onValueChange={(l) => changeShape(v.type, l === "true")}
        />
        <ValueControl
          label={row.kind === "app" ? `Default value of ${v.name}` : `Value of ${v.name}`}
          type={v.type}
          isList={v.isList}
          options={v.enumOptions}
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
