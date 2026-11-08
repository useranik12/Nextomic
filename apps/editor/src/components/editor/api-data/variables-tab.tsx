"use client";

import {
  BUILT_IN_REST_VARIABLES,
  REST_VALUE_TYPES,
  stateNameProblem,
  valueAfterTypeChange,
  type RestCall,
  type RestVariable
} from "@nextomic/schema";
import { useEffect, useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { TypePicker, useTypeRegistry } from "../data-types/type-picker";
import { ValueControl } from "../data-types/value-control";
import { compactFieldClass } from "../right-panel/setting-row";

const GRID =
  "grid grid-cols-[minmax(9rem,1.3fr)_minmax(11rem,1.2fr)_6rem_minmax(9rem,1.4fr)_2rem_2rem] items-start gap-2";

function nameProblem(name: string, taken: string[]): string | null {
  if ((BUILT_IN_REST_VARIABLES as readonly string[]).includes(name))
    return `"${name}" is filled by the server.`;
  return stateNameProblem(name, taken);
}

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
  const problem = draft === value ? null : nameProblem(draft, taken);
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

function freeName(taken: string[]): string {
  for (let i = 1; ; i++) if (!taken.includes(`variable_${i}`)) return `variable_${i}`;
}

/** Name, Type, Is List, Default Value, bolt (usually bound to dynamic data), delete. */
export function VariablesTab({
  call,
  onChange
}: {
  call: RestCall;
  onChange: (next: RestCall) => void;
}) {
  const registry = useTypeRegistry();
  const names = call.variables.map((v) => v.name);
  const update = (id: string, patch: Partial<RestVariable>) =>
    onChange({
      ...call,
      variables: call.variables.map((v) => (v.id === id ? { ...v, ...patch } : v))
    });

  return (
    <section aria-label="Variables" className="flex flex-col gap-3">
      <div>
        <h3 className="text-small font-medium text-foreground">Variables</h3>
        <p className="text-small text-default-500">
          Values the call needs. Use [name] in the URL and headers, &lt;name&gt; in the body. jwt
          and user_ip are filled by the server.
        </p>
      </div>
      {call.variables.length > 0 ? (
        <div className={`${GRID} text-small text-default-500`}>
          <span>Name</span>
          <span>Type</span>
          <span>Is List</span>
          <span>Default Value</span>
          <span className="sr-only">Dynamic</span>
          <span className="sr-only">Delete</span>
        </div>
      ) : (
        <p className="text-small text-default-500">No variables yet.</p>
      )}
      {call.variables.map((v) => (
        <div key={v.id} className={GRID}>
          <NameCell
            value={v.name}
            taken={names.filter((n) => n !== v.name)}
            onCommit={(name) => update(v.id, { name })}
          />
          <TypePicker
            label={`Type of ${v.name}`}
            spec={v}
            types={REST_VALUE_TYPES}
            onChange={(next) =>
              update(v.id, {
                type: next.type as RestVariable["type"],
                ref: next.ref,
                defaultValue: valueAfterTypeChange(v.defaultValue, { ...v, ...next }, registry)
              })
            }
          />
          <SelectField
            compact
            hideLabel
            label={`${v.name} is a list`}
            value={v.isList ? "true" : "false"}
            options={[
              { value: "false", label: "False" },
              { value: "true", label: "True" }
            ]}
            onValueChange={(value) => update(v.id, { isList: value === "true", defaultValue: "" })}
          />
          <ValueControl
            label={`Default value of ${v.name}`}
            spec={v}
            registry={registry}
            value={v.defaultValue}
            onChange={(defaultValue) => update(v.id, { defaultValue })}
          />
          <button
            type="button"
            aria-pressed={v.dynamic}
            aria-label={`${v.name} is usually bound to dynamic data`}
            data-tip="Usually bound to dynamic data where the call is used"
            onClick={() => update(v.id, { dynamic: !v.dynamic })}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-default-100 ${v.dynamic ? "text-warning" : "text-default-400"}`}
          >
            <Icon name="ph:lightning" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${v.name}`}
            onClick={() =>
              onChange({ ...call, variables: call.variables.filter((x) => x.id !== v.id) })
            }
            className="flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-danger/10"
          >
            <Icon name="ph:trash" width={16} height={16} />
          </button>
        </div>
      ))}
      <ActionButton
        size="sm"
        tone="ghost"
        className="self-start border border-default-200"
        onPress={() =>
          onChange({
            ...call,
            variables: [
              ...call.variables,
              {
                id: crypto.randomUUID(),
                name: freeName(names),
                type: "string",
                ref: "",
                isList: false,
                defaultValue: "",
                dynamic: false
              }
            ]
          })
        }
      >
        <Icon name="ph:plus-circle" width={14} height={14} />
        Add Variable
      </ActionButton>
    </section>
  );
}
