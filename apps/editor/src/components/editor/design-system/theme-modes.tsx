"use client";

import { addThemeMode, BUILTIN_MODE_IDS, removeThemeMode, type Theme } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";

/** The color modes of a theme: light and dark plus custom ones (up to 6), each with its own variable values. */
export function ThemeModes({ theme, onChange }: { theme: Theme; onChange: (next: Theme) => void }) {
  const [name, setName] = useState("");
  const full = theme.modes.length >= 6;

  function add() {
    const next = addThemeMode(theme, name);
    if (!next) return;
    onChange(next);
    setName("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-small font-medium text-foreground">Color modes</p>
      <ul className="flex flex-col gap-2" aria-label="Color modes">
        {theme.modes.map((mode) => {
          const builtin = BUILTIN_MODE_IDS.includes(mode.id);
          return (
            <li key={mode.id} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormInput
                  compact
                  label={builtin ? `${mode.name} (built in)` : `Mode ${mode.id}`}
                  value={mode.name}
                  onValueChange={(v) => {
                    const clean = v.slice(0, 32);
                    if (clean.trim() === "") return;
                    onChange({
                      ...theme,
                      modes: theme.modes.map((m) => (m.id === mode.id ? { ...m, name: clean } : m))
                    });
                  }}
                />
              </div>
              {builtin ? null : (
                <button
                  type="button"
                  aria-label={`Remove the ${mode.name} mode`}
                  onClick={() => onChange(removeThemeMode(theme, mode.id))}
                  className="mb-1 rounded-full p-2 text-default-500 hover:bg-danger/10 hover:text-danger"
                >
                  <Icon name="ph:trash" width={16} height={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <FormInput
            compact
            label="New mode name"
            placeholder="Sepia, High contrast..."
            value={name}
            disabled={full}
            onValueChange={setName}
          />
        </div>
        <ActionButton size="sm" onPress={add} isDisabled={full || name.trim() === ""}>
          Add mode
        </ActionButton>
      </div>
      <p className="text-tiny text-default-500">
        {full
          ? "A theme can have up to 6 modes."
          : "Set each mode's values under Variables below. Modes without a value use the default one."}
      </p>
    </div>
  );
}
