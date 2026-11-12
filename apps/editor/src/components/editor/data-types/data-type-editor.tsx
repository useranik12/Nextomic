"use client";

import { FIELD_TYPES, newDataTypeField, type DataType, type DataTypeField } from "@nextomic/schema";
import { useMemo } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";
import { IdentifierInput } from "./identifier-input";
import { useEditorStore } from "../store/editor-store";
import { TypePicker } from "./type-picker";

const GRID = "grid-cols-[minmax(9rem,1fr)_minmax(14rem,1.5fr)_6.5rem_minmax(9rem,1.2fr)_2rem]";

/** A data type and every data type that contains it (directly or through others). */
function containing(id: string, types: readonly DataType[]): string[] {
  const found = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of types)
      if (!found.has(t.id) && t.fields.some((f) => f.type === "dataType" && found.has(f.ref))) {
        found.add(t.id);
        grew = true;
      }
  }
  return [...found];
}

/** The fields of a custom data type: name, type (anything but a Supabase row), list, description. */
export function DataTypeEditor({
  value,
  onChange
}: {
  value: DataType;
  onChange: (next: DataType) => void;
}) {
  // A field cannot use its own data type, or a type that contains it: that would never end.
  const dataTypes = useEditorStore((s) => s.project.dataTypes);
  const excluded = useMemo(() => containing(value.id, dataTypes), [value.id, dataTypes]);
  const setField = (id: string, next: DataTypeField) =>
    onChange({ ...value, fields: value.fields.map((f) => (f.id === id ? next : f)) });
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Fields</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div
            className={`grid ${GRID} gap-2 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted`}
          >
            <span className="px-1">Name</span>
            <span className="px-1">Type</span>
            <span className="px-1">Is List</span>
            <span className="px-1">Description</span>
          </div>
          {value.fields.length === 0 ? (
            <p className="py-6 text-sm text-muted">
              No fields yet. A data type describes the shape of a value, for example an Address with
              street, city and zip.
            </p>
          ) : (
            <ul>
              {value.fields.map((field) => (
                <li
                  key={field.id}
                  className={`grid ${GRID} items-start gap-2 border-b border-border py-2 last:border-b-0`}
                >
                  <IdentifierInput
                    label="Field name"
                    value={field.name}
                    taken={value.fields.filter((f) => f.id !== field.id).map((f) => f.name)}
                    onCommit={(name) => setField(field.id, { ...field, name })}
                  />
                  <TypePicker
                    label={`Type of ${field.name}`}
                    spec={field}
                    types={FIELD_TYPES}
                    excludeDataTypes={excluded}
                    onChange={(next) =>
                      setField(field.id, {
                        ...field,
                        type: next.type === "supabaseRow" ? "json" : next.type,
                        ref: next.ref
                      })
                    }
                  />
                  <SelectField
                    compact
                    hideLabel
                    label={`Is ${field.name} a list`}
                    value={field.isList ? "true" : "false"}
                    options={[
                      { value: "false", label: "False" },
                      { value: "true", label: "True" }
                    ]}
                    onValueChange={(l) => setField(field.id, { ...field, isList: l === "true" })}
                  />
                  <input
                    aria-label={`Description of ${field.name}`}
                    placeholder="Description"
                    value={field.description}
                    maxLength={300}
                    onChange={(e) => setField(field.id, { ...field, description: e.target.value })}
                    className={compactFieldClass}
                  />
                  <button
                    type="button"
                    aria-label={`Delete field ${field.name}`}
                    onClick={() =>
                      onChange({ ...value, fields: value.fields.filter((f) => f.id !== field.id) })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full text-danger transition-colors duration-300 hover:bg-danger/10"
                  >
                    <Icon name="ph:trash" width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div>
        <ActionButton
          size="sm"
          tone="outline"
          onPress={() =>
            onChange({
              ...value,
              fields: [
                ...value.fields,
                newDataTypeField(
                  crypto.randomUUID(),
                  value.fields.map((f) => f.name)
                )
              ]
            })
          }
        >
          <Icon name="ph:plus" width={14} height={14} />
          Add Field
        </ActionButton>
      </div>
    </div>
  );
}
