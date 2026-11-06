"use client";

import { ColorField } from "@/components/ui/color-field";
import {
  SAFE_VALUE,
  themeModes,
  VARIABLE_PREFIX,
  type ProjectVariable,
  type Theme
} from "@nextomic/schema";
import { FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";

/** Per-mode overrides of project variables. A mode left empty keeps the base value. */
export function ThemeVariables({
  theme,
  variables,
  onChange
}: {
  theme: Theme;
  variables: readonly ProjectVariable[];
  onChange: (overrides: Theme["variables"]) => void;
}) {
  const overrides = theme.variables;
  const names = Object.keys(overrides);
  const available = variables.filter((v) => !(v.name in overrides));

  function setValue(name: string, modeId: string, value: string) {
    if (!SAFE_VALUE.test(value)) return;
    const current = { ...overrides[name] };
    if (value.trim() === "") delete current[modeId];
    else current[modeId] = value;
    onChange({ ...overrides, [name]: current });
  }

  return (
    <div className="flex flex-col gap-3">
      {names.length === 0 ? (
        <p className="text-small text-default-500">
          No overrides. Everything uses the base variables from the Variables tab.
        </p>
      ) : null}
      {names.map((name) => {
        const original = variables.find((v) => v.name === name);
        return (
          <div key={name} className="flex flex-col gap-2 rounded-large border border-divider p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-small">
                {VARIABLE_PREFIX}
                {name}
                {original ? null : <span className="ml-2 text-tiny text-danger">missing</span>}
              </span>
              <button
                type="button"
                aria-label={`Remove override ${name}`}
                onClick={() => {
                  const next = { ...overrides };
                  delete next[name];
                  onChange(next);
                }}
                className="rounded p-1 text-default-500 hover:text-danger"
              >
                <Icon name="ph:trash" width={14} height={14} />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {themeModes(theme).map((mode) => {
                const value = overrides[name]?.[mode.id] ?? "";
                return (
                  <div key={mode.id} className="min-w-0">
                    {original?.type === "color" ? (
                      <ColorField
                        label={`${name} ${mode.name} color`}
                        value={value}
                        display={original.value}
                        onChange={(v) => setValue(name, mode.id, v)}
                      />
                    ) : (
                      <FormInput
                        compact
                        label={mode.name}
                        placeholder={original?.value ?? ""}
                        value={value}
                        onValueChange={(v) => setValue(name, mode.id, v)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {available.length > 0 ? (
        <SelectField
          compact
          label="Override a variable"
          value=""
          onValueChange={(name) => {
            if (name) onChange({ ...overrides, [name]: {} });
          }}
          options={[
            { value: "", label: "Choose a variable..." },
            ...available.map((v) => ({ value: v.name, label: `${VARIABLE_PREFIX}${v.name}` }))
          ]}
        />
      ) : null}
    </div>
  );
}
