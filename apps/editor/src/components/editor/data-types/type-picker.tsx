"use client";

import {
  REF_TYPES,
  STATE_TYPES,
  STATE_TYPE_LABELS,
  type StateType,
  type TypeSpec
} from "@nextomic/schema";
import { useMemo } from "react";
import { SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";

/**
 * A type choice: the type, and for Enum, Data Type and Supabase Row the enum, data type or table it
 * uses. Only enums and data types made on the Data Types page can be chosen.
 */
export function TypePicker({
  label,
  spec,
  onChange,
  types = STATE_TYPES,
  compact = true
}: {
  label: string;
  spec: Pick<TypeSpec, "type" | "ref">;
  onChange: (next: { type: StateType; ref: string }) => void;
  types?: readonly StateType[];
  compact?: boolean;
}) {
  const enums = useEditorStore((s) => s.project.enums);
  const dataTypes = useEditorStore((s) => s.project.dataTypes);
  const refs =
    spec.type === "enum"
      ? enums.map((e) => ({ value: e.id, label: e.name }))
      : spec.type === "dataType"
        ? dataTypes.map((d) => ({ value: d.id, label: d.name }))
        : [];
  const empty =
    spec.type === "enum"
      ? "No enums yet. Add one on the Data Types page."
      : spec.type === "dataType"
        ? "No data types yet. Add one on the Data Types page."
        : "Connect Supabase and fetch its schema to choose a table.";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SelectField
        compact={compact}
        hideLabel
        label={label}
        value={spec.type}
        options={types.map((t) => ({ value: t, label: STATE_TYPE_LABELS[t] }))}
        onValueChange={(t) => {
          const type = t as StateType;
          const first =
            type === "enum" ? enums[0]?.id : type === "dataType" ? dataTypes[0]?.id : undefined;
          onChange({ type, ref: REF_TYPES.has(type) ? (first ?? "") : "" });
        }}
      />
      {REF_TYPES.has(spec.type) ? (
        refs.length === 0 ? (
          <p className="px-2 text-tiny text-default-500">{empty}</p>
        ) : (
          <SelectField
            compact={compact}
            hideLabel
            label={`${STATE_TYPE_LABELS[spec.type]} for ${label}`}
            value={spec.ref || "none"}
            options={[...(spec.ref ? [] : [{ value: "none", label: "Choose…" }]), ...refs]}
            onValueChange={(ref) => onChange({ type: spec.type, ref: ref === "none" ? "" : ref })}
          />
        )
      ) : null}
    </div>
  );
}

/** The enums and data types of the project, for checking values. */
export function useTypeRegistry() {
  const enums = useEditorStore((s) => s.project.enums);
  const dataTypes = useEditorStore((s) => s.project.dataTypes);
  return useMemo(() => ({ enums, dataTypes }), [enums, dataTypes]);
}
