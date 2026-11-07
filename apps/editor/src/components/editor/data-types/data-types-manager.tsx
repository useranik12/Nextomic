"use client";

import {
  appEnumListSchema,
  dataTypeListSchema,
  newAppEnum,
  newDataType,
  typeReferences,
  type AppEnum,
  type DataType
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";
import { useEditorStore } from "../store/editor-store";
import { DataTypeEditor } from "./data-type-editor";
import { EnumEditor } from "./enum-editor";
import { IdentifierInput } from "./identifier-input";

type Tab = "types" | "enums";
type Item = DataType | AppEnum;

const TABS: { id: Tab; label: string }[] = [
  { id: "types", label: "Custom Data Types" },
  { id: "enums", label: "ENUM" }
];

/**
 * Data Types (left rail, before State Management): custom data types and enums made in the app.
 * State variables, constants, page state and data type fields can then use them as types.
 */
export function DataTypesManager() {
  const [tab, setTab] = useState<Tab>("types");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const project = useEditorStore((s) => s.project);
  const patchProject = useEditorStore((s) => s.patchProject);
  const list: Item[] = tab === "types" ? project.dataTypes : project.enums;
  const selected = list.find((i) => i.id === selectedId) ?? list[0] ?? null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((i) => i.name.toLowerCase().includes(q)) : list;
  }, [list, query]);

  function commit(next: Item[]) {
    const parsed = (tab === "types" ? dataTypeListSchema : appEnumListSchema).safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid entry.");
    setError(null);
    patchProject(
      tab === "types"
        ? { dataTypes: parsed.data as DataType[] }
        : { enums: parsed.data as AppEnum[] }
    );
  }
  const replace = (next: Item) => commit(list.map((i) => (i.id === next.id ? next : i)));

  function add() {
    const id = crypto.randomUUID();
    const taken = list.map((i) => i.name);
    commit([...list, tab === "types" ? newDataType(id, taken) : newAppEnum(id, taken)]);
    setSelectedId(id);
    setQuery("");
  }

  function remove(item: Item) {
    const uses = typeReferences(item.id, project);
    const message =
      uses.length > 0
        ? `"${item.name}" is used by: ${uses.join(", ")}. They will need another type. Delete it?`
        : `Delete "${item.name}"?`;
    if (!window.confirm(message)) return;
    commit(list.filter((i) => i.id !== item.id));
    setSelectedId(null);
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-72 shrink-0 flex-col border-r border-divider">
        <div className="flex flex-col gap-3 border-b border-divider p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-medium font-semibold">Data Types</h1>
            <button
              type="button"
              aria-label={tab === "types" ? "Add data type" : "Add enum"}
              onClick={add}
              className="flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
            >
              <Icon name="ph:plus-circle" width={20} height={20} />
            </button>
          </div>
          <div
            role="tablist"
            aria-label="Data types"
            className="flex gap-1 rounded-full bg-default-100 p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setSelectedId(null);
                  setQuery("");
                  setError(null);
                }}
                className={
                  "flex-1 whitespace-nowrap rounded-full px-2 py-1 text-tiny transition-colors duration-300 " +
                  (tab === t.id
                    ? "bg-default-300 font-medium text-foreground"
                    : "text-default-600 hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            aria-label={tab === "types" ? "Search data types" : "Search enums"}
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={compactFieldClass}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={selected?.id === item.id}
                onClick={() => setSelectedId(item.id)}
                className={
                  "flex w-full items-center justify-between gap-2 rounded-medium px-3 py-2 text-left text-small transition-colors duration-300 " +
                  (selected?.id === item.id ? "bg-default-200" : "hover:bg-default-100")
                }
              >
                <span className="truncate font-mono">{item.name}</span>
                <span className="shrink-0 text-tiny text-default-500">
                  {"fields" in item
                    ? `${item.fields.length} fields`
                    : `${item.values.length} values`}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 ? (
            <li className="p-2 text-small text-default-500">
              {tab === "types" ? "No data types yet." : "No enums yet."} Use + to add one.
            </li>
          ) : shown.length === 0 ? (
            <li className="p-2 text-small text-default-500">Nothing matches.</li>
          ) : null}
        </ul>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <label className="flex max-w-sm flex-col gap-1">
                  <span className="text-tiny font-medium text-default-600">Name</span>
                  <IdentifierInput
                    label={tab === "types" ? "Data type name" : "Enum name"}
                    value={selected.name}
                    taken={list.filter((i) => i.id !== selected.id).map((i) => i.name)}
                    onCommit={(name) => replace({ ...selected, name })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-tiny font-medium text-default-600">Description</span>
                  <input
                    value={selected.description}
                    maxLength={300}
                    placeholder="What it is for"
                    onChange={(e) => replace({ ...selected, description: e.target.value })}
                    className={compactFieldClass}
                  />
                </label>
              </div>
              <ActionButton size="sm" tone="danger-ghost" onPress={() => remove(selected)}>
                <Icon name="ph:trash" width={14} height={14} />
                Delete
              </ActionButton>
            </div>
            {error ? (
              <p role="alert" className="text-tiny text-danger">
                {error}
              </p>
            ) : null}
            {"fields" in selected ? (
              <DataTypeEditor value={selected} onChange={replace} />
            ) : (
              <EnumEditor value={selected} onChange={replace} />
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-small text-default-500">
            {tab === "types"
              ? "Custom data types describe structured values, such as an Address or a Product. Add one with +."
              : "Enums are fixed lists of choices, such as order statuses. Add one with +."}
          </div>
        )}
      </main>
    </div>
  );
}
