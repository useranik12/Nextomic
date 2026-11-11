"use client";

import {
  activeQuery,
  callVariables,
  findNode,
  refreshFields,
  type ParamField,
  type ParamRow,
  type Params
} from "@nextomic/schema";
import { BoltInput } from "../../right-panel/bolt-input";
import { useQuerySources } from "../../query/use-query-sources";
import { useEditorStore } from "../../store/editor-store";

// The new values Refresh Query gives the chosen query loop: one input per setting the loop
// exposes (Supabase filter values, REST variables, Limit). An input left empty keeps what the
// loop already has.

export function QueryParamsInput({
  field,
  params,
  rows,
  onChange
}: {
  field: ParamField;
  params: Params;
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
}) {
  const projectId = useEditorStore((s) => s.projectId);
  const tree = useEditorStore((s) => s.doc?.tree);
  const { data } = useQuerySources(projectId);
  const source = params[field.targetParam ?? ""];
  const id = typeof source === "string" ? source : "";
  const query = tree && id ? activeQuery(findNode(tree, id)?.node ?? { type: "" }) : null;
  let variables: string[] = [];
  if (query?.source === "rest" && data) {
    const call = data.rest.calls.find((c) => c.id === query.rest.callId);
    const group = call?.groupId
      ? (data.rest.groups.find((g) => g.id === call.groupId) ?? null)
      : null;
    variables = call ? callVariables(call, group).map((v) => v.name) : [];
  }
  const fields = query ? refreshFields(query, variables) : [];
  const valueOf = (name: string) => rows.find((r) => r.name === name)?.value ?? "";
  const set = (name: string, value: string) =>
    onChange([
      ...rows.filter((r) => r.name !== name && fields.some((f) => f.name === r.name)),
      ...(value === "" ? [] : [{ name, value }])
    ]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small font-medium text-default-700">{field.label}</legend>
      {!id ? (
        <p className="text-tiny text-default-500">Choose a query loop to see its settings.</p>
      ) : !query ? (
        <p className="text-tiny text-danger">This query loop is no longer on the page.</p>
      ) : fields.length === 0 ? (
        <p className="text-tiny text-default-500">
          This loop has no settings to change. It is refreshed with the values it has.
        </p>
      ) : (
        fields.map((f) => (
          <BoltInput
            key={f.name}
            label={f.label}
            value={valueOf(f.name)}
            onValueChange={(v) => set(f.name, v)}
            placeholder="Keep the loop's value"
          />
        ))
      )}
    </fieldset>
  );
}
