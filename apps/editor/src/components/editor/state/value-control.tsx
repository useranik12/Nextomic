"use client";

import { checkStateValue, type StateType } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/controls";
import { ColorField } from "@/components/ui/color-field";
import { compactFieldClass } from "../right-panel/setting-row";

const NATIVE_TYPE: Partial<Record<StateType, string>> = {
  integer: "number",
  float: "number",
  date: "date",
  time: "time",
  datetime: "datetime-local",
  url: "url"
};

const PLACEHOLDER: Partial<Record<StateType, string>> = {
  string: "Text",
  integer: "0",
  float: "0.0",
  url: "https://… or /path",
  json: '{ "key": "value" }'
};

/**
 * The value of a state variable or constant, with a control that fits its type: a True/False
 * select for Boolean, the color picker for Color, date and time pickers, a JSON box for JSON and
 * lists, the options for Enum. Text that does not fit the type is shown with the reason and is not
 * saved until it is fixed.
 */
export function ValueControl({
  label,
  type,
  isList,
  options,
  value,
  onChange
}: {
  label: string;
  type: StateType;
  isList: boolean;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const problem = checkStateValue(type, isList, draft, options);
  const commit = (next: string) => {
    setDraft(next);
    if (checkStateValue(type, isList, next, options) === null) onChange(next);
  };
  const error = problem ? (
    <p role="alert" className="mt-0.5 px-2 text-tiny text-danger">
      {problem}
    </p>
  ) : null;

  if (isList || type === "json")
    return (
      <div className="min-w-0">
        <textarea
          aria-label={label}
          aria-invalid={Boolean(problem)}
          rows={1}
          spellCheck={false}
          placeholder={isList ? '["first", "second"]' : PLACEHOLDER.json}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          className={`${compactFieldClass} !h-auto min-h-8 resize-y !rounded-large py-1.5 font-mono text-tiny ${problem ? "!border-danger" : ""}`}
        />
        {error}
      </div>
    );
  if (type === "boolean")
    return (
      <SelectField
        compact
        hideLabel
        label={label}
        value={draft === "" ? "none" : draft}
        onValueChange={(v) => commit(v === "none" ? "" : v)}
        options={[
          { value: "none", label: "No value" },
          { value: "true", label: "True" },
          { value: "false", label: "False" }
        ]}
      />
    );
  if (type === "enum")
    return options.length === 0 ? (
      <p className="px-2 text-tiny text-default-500">Add options in the row details first.</p>
    ) : (
      <SelectField
        compact
        hideLabel
        label={label}
        value={draft === "" ? "none" : draft}
        onValueChange={(v) => commit(v === "none" ? "" : v)}
        options={[
          { value: "none", label: "No value" },
          ...options.map((o) => ({ value: o, label: o }))
        ]}
      />
    );
  if (type === "color")
    return (
      <div className="min-w-0">
        <ColorField label={label} value={draft} onChange={commit} />
        {error}
      </div>
    );
  return (
    <div className="min-w-0">
      <input
        aria-label={label}
        aria-invalid={Boolean(problem)}
        type={NATIVE_TYPE[type] ?? "text"}
        step={type === "float" ? "any" : type === "time" ? 1 : undefined}
        placeholder={PLACEHOLDER[type] ?? ""}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        className={`${compactFieldClass} ${problem ? "!border-danger" : ""}`}
      />
      {error}
    </div>
  );
}
