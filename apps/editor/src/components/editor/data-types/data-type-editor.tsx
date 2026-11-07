"use client";

import { FIELD_TYPES, newDataTypeField, type DataType, type DataTypeField } from "@nextomic/schema";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";
import { IdentifierInput } from "./identifier-input";
import { TypePicker } from "./type-picker";

const GRID = "grid-cols-[minmax(9rem,1fr)_minmax(11rem,1fr)_7rem_minmax(9rem,1.2fr)_2rem]";

/** The fields of a custom data type: name, type (anything but a Supabase row), list, description. */
export function DataTypeEditor({
  value,
  onChange
}: {
  value: DataType;
  onChange: (next: DataType) => void;
}) {
  const setField = (id: string, next: DataTypeField) =>
    onChange({ ...value, fields: value.fields.map((f) => (f.id === id ? next : f)) });
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-small font-semibold">Fields</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div
            className={`grid ${GRID} gap-2 border-b border-divider pb-2 text-small font-medium text-default-600`}
          >
            <span className="px-1">Name</span>
            <span className="px-1">Type</span>
            <span className="px-1">Is List</span>
            <span className="px-1">Description</span>
          </div>
          {value.fields.length === 0 ? (
            <p className="py-6 text-small text-default-500">
              No fields yet. A data type describes the shape of a value, for example an Address with
              street, city and zip.
            </p>
          ) : (
            <ul>
              {value.fields.map((field) => (
                <li
                  key={field.id}
                  className={`grid ${GRID} items-start gap-2 border-b border-divider py-2 last:border-b-0`}
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
          tone="ghost"
          className="border border-default-300"
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
