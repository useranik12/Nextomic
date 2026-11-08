"use client";

import { callVariables, type RestConfig, type RestLoopQuery } from "@nextomic/schema";
import { SelectField, type SelectOption } from "@/components/ui/controls";
import { BoltInput } from "../right-panel/bolt-input";
import { RowSettings } from "./row-settings";

// REST settings of a query loop: a saved API Data call, a value for each of its variables (the
// group's shared variables too), which part of the response is the list, and the rows.

const WHOLE = "__whole__";

function callOptions(config: RestConfig): SelectOption[] {
  const groups = new Map(config.groups.map((g) => [g.id, g.name]));
  return config.calls
    .map((call) => {
      const group = call.groupId ? groups.get(call.groupId) : undefined;
      return {
        value: call.id,
        label: group ? `${group} / ${call.name}` : call.name,
        disabled: !call.active,
        hint: call.active ? undefined : "This call is turned off in API Data."
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function RestQueryForm({
  value,
  config,
  onChange
}: {
  value: RestLoopQuery;
  config: RestConfig;
  onChange: (next: RestLoopQuery) => void;
}) {
  const call = config.calls.find((c) => c.id === value.callId);
  const group = call?.groupId ? (config.groups.find((g) => g.id === call.groupId) ?? null) : null;
  const variables = call ? callVariables(call, group) : [];
  const patch = (next: Partial<RestLoopQuery>) => onChange({ ...value, ...next });
  const options = callOptions(config);

  return (
    <>
      <SelectField
        compact
        label="API call"
        options={value.callId ? options : [{ value: "", label: "Choose a call" }, ...options]}
        value={value.callId}
        onValueChange={(callId) => patch({ callId, values: {}, listPath: "" })}
      />
      {call && variables.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-tiny font-medium text-default-600">Variables</legend>
          {variables.map((variable) => (
            <BoltInput
              key={variable.name}
              label={variable.name}
              placeholder={variable.defaultValue || "Default (empty)"}
              value={value.values[variable.name] ?? ""}
              onValueChange={(text) => {
                const values = { ...value.values };
                if (text === "") delete values[variable.name];
                else values[variable.name] = text;
                patch({ values });
              }}
            />
          ))}
        </fieldset>
      ) : null}
      {call ? (
        <SelectField
          compact
          label="List"
          description="The JSON path that holds the rows, or the whole response."
          options={[
            { value: WHOLE, label: "Whole response" },
            ...call.response.jsonPaths.map((p) => ({ value: p.id, label: `${p.name} (${p.path})` }))
          ]}
          value={value.listPath || WHOLE}
          onValueChange={(id) => patch({ listPath: id === WHOLE ? "" : id })}
        />
      ) : null}
      <RowSettings value={value} onChange={patch} />
    </>
  );
}
