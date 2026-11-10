"use client";

import type { ParamField, ParamRow, Params } from "@nextomic/schema";
import { BoltInput } from "../../right-panel/bolt-input";
import { paramsOfTarget, useFlowTargets } from "./flow-targets";

// The values Navigate To or Show Toast passes: one input per parameter of the chosen page or
// template. A required parameter is marked with a red asterisk and must get a value.

export function TargetParamsInput({
  field,
  sourceKind,
  params,
  rows,
  onChange
}: {
  field: ParamField;
  /** What the action's target field picks. */
  sourceKind: "page" | "template";
  params: Params;
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
}) {
  const pages = useFlowTargets((s) => s.pages);
  const templates = useFlowTargets((s) => s.templates);
  const source = params[field.targetParam ?? ""];
  const id = typeof source === "string" ? source : "";
  const defs = id ? paramsOfTarget(sourceKind, id, pages, templates) : [];
  const noun = sourceKind === "page" ? "page" : "template";
  const valueOf = (name: string) => rows.find((r) => r.name === name)?.value ?? "";
  const set = (name: string, value: string) =>
    onChange([
      ...rows.filter((r) => r.name !== name && defs.some((d) => d.name === r.name)),
      ...(value === "" ? [] : [{ name, value }])
    ]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small font-medium text-default-700">{field.label}</legend>
      {!id ? (
        <p className="text-tiny text-default-500">Choose a {noun} to see its parameters.</p>
      ) : defs.length === 0 ? (
        <p className="text-tiny text-default-500">This {noun} has no parameters.</p>
      ) : (
        defs.map((def) => (
          <BoltInput
            key={def.name}
            label={def.name}
            isRequired={def.required}
            value={valueOf(def.name)}
            onValueChange={(v) => set(def.name, v)}
            placeholder={def.defaultValue ? `Default: ${def.defaultValue}` : undefined}
            description={def.type}
            isInvalid={def.required && valueOf(def.name).trim() === ""}
            errorMessage={def.required ? "Required: pass a value." : undefined}
          />
        ))
      )}
    </fieldset>
  );
}
