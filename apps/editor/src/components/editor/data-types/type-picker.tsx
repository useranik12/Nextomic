"use client";

import {
  REF_TYPES,
  STATE_TYPES,
  STATE_TYPE_LABELS,
  type StateType,
  type TypeSpec
} from "@nextomic/schema";
import { useMemo } from "react";
import { SelectField, type SelectOption } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";

/** Why a type cannot be chosen yet, or null when it can. */
function unavailable(type: StateType, enums: number, dataTypes: number): string | null {
  if (type === "enum" && enums === 0) return "Add an enum on the Data Types page first.";
  if (type === "dataType" && dataTypes === 0)
    return "Add a custom data type on the Data Types page first.";
  if (type === "supabaseRow") return "Connect Supabase and fetch its schema first.";
  return null;
}

/**
 * A type choice: the type, and beside it for ENUM and Data Type which one it uses. Only enums and
 * data types made on the Data Types page can be chosen; types with nothing to choose are shown
 * disabled with a hint. `excludeDataTypes` leaves out data types that must not be used here (a data
 * type itself, and the types that already contain it).
 */
export function TypePicker({
  label,
  spec,
  onChange,
  types = STATE_TYPES,
  excludeDataTypes = [],
  compact = true
}: {
  label: string;
  spec: Pick<TypeSpec, "type" | "ref">;
  onChange: (next: { type: StateType; ref: string }) => void;
  types?: readonly StateType[];
  excludeDataTypes?: readonly string[];
  compact?: boolean;
}) {
  const enums = useEditorStore((s) => s.project.enums);
  const allDataTypes = useEditorStore((s) => s.project.dataTypes);
  const dataTypes = useMemo(
    () => allDataTypes.filter((d) => !excludeDataTypes.includes(d.id)),
    [allDataTypes, excludeDataTypes]
  );
  const refs =
    spec.type === "enum"
      ? enums.map((e) => ({ value: e.id, label: e.name }))
      : spec.type === "dataType"
        ? dataTypes.map((d) => ({ value: d.id, label: d.name }))
        : [];
  const typeOptions: SelectOption[] = types.map((t) => {
    const hint = unavailable(t, enums.length, dataTypes.length);
    return {
      value: t,
      label: STATE_TYPE_LABELS[t],
      disabled: hint !== null,
      hint: hint ?? undefined
    };
  });
  const showRef = REF_TYPES.has(spec.type) && refs.length > 0;
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <SelectField
        compact={compact}
        hideLabel
        label={label}
        value={spec.type}
        className="min-w-0 flex-1"
        options={typeOptions}
        onValueChange={(t) => {
          const type = t as StateType;
          const first =
            type === "enum" ? enums[0]?.id : type === "dataType" ? dataTypes[0]?.id : undefined;
          onChange({ type, ref: REF_TYPES.has(type) ? (first ?? "") : "" });
        }}
      />
      {showRef ? (
        <SelectField
          compact={compact}
          hideLabel
          label={`${STATE_TYPE_LABELS[spec.type]} for ${label}`}
          value={spec.ref || "none"}
          className="min-w-0 flex-1"
          options={[...(spec.ref ? [] : [{ value: "none", label: "Choose…" }]), ...refs]}
          onValueChange={(ref) => onChange({ type: spec.type, ref: ref === "none" ? "" : ref })}
        />
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
