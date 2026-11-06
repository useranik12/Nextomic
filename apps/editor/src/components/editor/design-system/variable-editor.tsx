"use client";

import {
  VARIABLE_TYPES,
  VARIABLE_TYPE_LABEL,
  fluidClamp,
  isHexColor,
  type FluidSize,
  type ProjectVariable,
  type VariableType
} from "@nextomic/schema";
import { FormInput, SelectField } from "@/components/ui/controls";

export const DEFAULT_FLUID: FluidSize = { min: 16, max: 20, minViewport: 320, maxViewport: 1240 };

const VALUE_HINT: Record<VariableType, string> = {
  color: "#0066ff",
  size: "1rem",
  "fluid-size": "",
  "font-family": "system-ui, sans-serif",
  "font-weight": "600",
  shadow: "0 4px 12px rgba(0,0,0,.2)",
  radius: "8px",
  number: "1",
  string: "text"
};

export const typeOptions = VARIABLE_TYPES.map((t) => ({ value: t, label: VARIABLE_TYPE_LABEL[t] }));

/** Draft of a variable while it is being created or edited; `error` is set when it is not valid yet. */
export function withType(v: ProjectVariable, type: VariableType): ProjectVariable {
  if (type === "fluid-size") {
    const fluid = v.fluid ?? DEFAULT_FLUID;
    return { ...v, type, fluid, value: fluidClamp(fluid) };
  }
  const { fluid: _dropped, ...rest } = v;
  return { ...rest, type, value: v.type === "fluid-size" ? "" : v.value };
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <FormInput
      compact
      type="number"
      label={label}
      value={String(value)}
      onValueChange={(next) => {
        const n = Number(next);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

/** The type, value and group fields of one variable. Changes go out through `onChange` at once. */
export function VariableFields({
  variable,
  onChange,
  groups
}: {
  variable: ProjectVariable;
  onChange: (next: ProjectVariable) => void;
  groups: string[];
}) {
  const fluid = variable.fluid;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Type"
          compact
          value={variable.type}
          options={typeOptions}
          onValueChange={(t) => onChange(withType(variable, t as VariableType))}
        />
        <FormInput
          compact
          label="Group"
          value={variable.group}
          list="variable-groups"
          onValueChange={(group) => onChange({ ...variable, group })}
        />
        <datalist id="variable-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      {fluid ? (
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["Min size (px)", "min"],
              ["Max size (px)", "max"],
              ["Min viewport (px)", "minViewport"],
              ["Max viewport (px)", "maxViewport"]
            ] as const
          ).map(([label, key]) => (
            <NumberField
              key={key}
              label={label}
              value={fluid[key]}
              onChange={(n) => {
                const next = { ...fluid, [key]: n };
                onChange({ ...variable, fluid: next, value: fluidClamp(next) });
              }}
            />
          ))}
          <p className="col-span-2 break-all font-mono text-tiny text-default-500">
            {variable.value}
          </p>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {variable.type === "color" ? (
            <input
              type="color"
              aria-label="Pick a color"
              value={isHexColor(variable.value) ? variable.value : "#000000"}
              onChange={(e) => onChange({ ...variable, value: e.target.value })}
              className="h-8 w-10 shrink-0 cursor-pointer rounded-medium border-2 border-default-200 bg-transparent p-0.5"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <FormInput
              compact
              label="Value"
              placeholder={VALUE_HINT[variable.type]}
              value={variable.value}
              onValueChange={(value) => onChange({ ...variable, value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
