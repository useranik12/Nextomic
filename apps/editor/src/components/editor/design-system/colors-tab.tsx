"use client";

import { VARIABLE_NAME_PATTERN, colorShades, isHexColor } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";

/** Color palettes: eleven shades (50 to 950) from one base color, saved as color variables. */
export function ColorsTab() {
  const [name, setName] = useState("brand");
  const [base, setBase] = useState("#0066ff");
  const nameOk = VARIABLE_NAME_PATTERN.test(name) && name.length <= 40;
  const baseOk = isHexColor(base);
  const shades = useMemo(
    () => (nameOk && baseOk ? colorShades(name, base) : []),
    [name, base, nameOk, baseOk]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-divider p-4">
        <h3 className="text-small font-medium">Color palettes</h3>
        <p className="mt-1 text-tiny text-default-500">
          Pick a base color and get shades 50 to 950 as variables (--nxt-{name || "brand"}-500 is
          the base itself). Edit any shade afterwards in Variables.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-3 border-r border-divider p-4">
          <FormInput
            compact
            label="Palette name"
            value={name}
            onValueChange={setName}
            isInvalid={!nameOk}
          />
          <div className="flex items-end gap-2">
            <input
              type="color"
              aria-label="Pick the base color"
              value={baseOk ? base : "#000000"}
              onChange={(e) => setBase(e.target.value)}
              className="h-8 w-10 shrink-0 cursor-pointer rounded-medium border-2 border-default-200 bg-transparent p-0.5"
            />
            <div className="min-w-0 flex-1">
              <FormInput
                compact
                label="Base color"
                value={base}
                onValueChange={setBase}
                isInvalid={!baseOk}
              />
            </div>
          </div>
          {!nameOk || !baseOk ? (
            <p role="alert" className="text-tiny text-danger">
              {!nameOk
                ? "Use lowercase letters, digits and -, starting with a letter."
                : "Use a six digit hex color such as #0066ff."}
            </p>
          ) : null}
          <ActionButton
            isDisabled={shades.length === 0}
            onPress={() => useEditorStore.getState().upsertVariables(shades)}
          >
            Apply {shades.length || 11} variables
          </ActionButton>
        </div>
        <ul className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 overflow-y-auto p-4">
          {shades.map((v) => (
            <li key={v.name} className="flex flex-col gap-1">
              <span
                style={{ background: v.value }}
                className="h-14 rounded-medium border border-divider"
              />
              <span className="font-mono text-tiny text-foreground">{v.name.split("-").pop()}</span>
              <span className="font-mono text-tiny text-default-500">{v.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
