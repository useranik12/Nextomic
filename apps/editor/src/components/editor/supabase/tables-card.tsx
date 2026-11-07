"use client";

import {
  appEnumListSchema,
  enumInSync,
  enumNameOf,
  shortPgType,
  saveSupabaseEnums,
  STATE_TYPE_LABELS,
  tableEnums,
  type AppEnum,
  type SupabaseColumn,
  type SupabaseEnum,
  type SupabaseSchemaEntry,
  type SupabaseTable
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { SupabaseCard } from "./supabase-page";
import type { SupabasePageModel } from "./use-supabase-page";

const typeLabel = (c: SupabaseColumn) => `${STATE_TYPE_LABELS[c.type]}${c.isList ? "[]" : ""}`;
const enumOf = (c: SupabaseColumn): SupabaseEnum | null =>
  c.enumValues ? { name: enumNameOf(c.pgType), values: c.enumValues } : null;

/** Saves Supabase enums into the app's enums (Data Types page); the project autosaves. */
function useEnumSaver() {
  const enums = useEditorStore((s) => s.project.enums);
  const patchProject = useEditorStore((s) => s.patchProject);
  const [error, setError] = useState<string | null>(null);
  function save(items: SupabaseEnum[]) {
    const next = saveSupabaseEnums(enums, items, () => crypto.randomUUID());
    const parsed = appEnumListSchema.safeParse(next);
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "Could not save the enum.");
    setError(null);
    patchProject({ enums: parsed.data as AppEnum[] });
  }
  return { enums, save, error };
}

/** Key for a primary key, link for a foreign key (target below the name), `*` for required. */
function ColumnName({ column }: { column: SupabaseColumn }) {
  return (
    <span className="flex items-start gap-2">
      <span className="flex w-4 shrink-0 justify-center pt-0.5">
        {column.primaryKey ? (
          <span data-tip="Primary key" aria-label="Primary key" role="img" className="text-warning">
            <Icon name="ph:key" width={16} height={16} />
          </span>
        ) : column.references ? (
          <span
            data-tip={`Foreign key to ${column.references}`}
            aria-label={`Foreign key to ${column.references}`}
            role="img"
            className="text-primary"
          >
            <Icon name="ph:link" width={16} height={16} />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-0.5 font-mono text-small text-primary">
          {column.name}
          {!column.nullable ? (
            <span
              data-tip="Required: cannot be empty (NOT NULL)"
              aria-label="required"
              className="text-danger"
            >
              *
            </span>
          ) : null}
        </span>
        {column.references ? (
          <span className="font-mono text-tiny text-default-500">{column.references}</span>
        ) : null}
      </span>
    </span>
  );
}

function TableDetail({ table }: { table: SupabaseTable }) {
  const { enums, save, error } = useEnumSaver();
  const used = tableEnums(table);
  const allSynced = used.every((e) => enumInSync(enums, e));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-medium font-semibold text-foreground">{table.name}</h3>
        <span className="rounded-full bg-default-100 px-2 py-0.5 text-tiny text-default-600">
          {table.kind === "view" ? "View (read only)" : "Table"}
        </span>
        {used.length > 0 ? (
          <ActionButton
            size="sm"
            tone="ghost"
            className="ml-auto border border-default-200"
            isDisabled={allSynced}
            onPress={() => save(used)}
          >
            {allSynced ? "Enums saved" : "Save All Enums"}
          </ActionButton>
        ) : null}
      </div>
      {table.description ? (
        <p className="text-small text-default-500">{table.description}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <div className="min-h-0 overflow-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead className="sticky top-0 bg-background">
            <tr className="text-small text-default-500">
              <th className="pb-2 font-normal">Field Name</th>
              <th className="pb-2 font-normal">Data Type</th>
              <th className="pb-2 font-normal">PostgreSQL Type</th>
              {used.length > 0 ? (
                <th className="pb-2 font-normal">
                  <span className="sr-only">Enum</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column) => {
              const item = enumOf(column);
              const synced = item ? enumInSync(enums, item) : false;
              return (
                <tr key={column.name} className="border-b border-divider align-top last:border-b-0">
                  <td className="py-2 pr-3">
                    <ColumnName column={column} />
                  </td>
                  <td className="py-2 pr-3 text-small text-default-500">
                    {typeLabel(column)}
                    {column.enumValues ? (
                      <span className="block text-tiny text-default-400">
                        {column.enumValues.join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-small text-default-500">
                    {shortPgType(column.pgType)}
                  </td>
                  {used.length > 0 ? (
                    <td className="py-1.5 text-right">
                      {item ? (
                        <ActionButton
                          size="sm"
                          tone="ghost"
                          className="border border-default-200"
                          isDisabled={synced}
                          aria-label={`Save enum ${item.name}`}
                          onPress={() => save([item])}
                        >
                          {synced ? "Saved" : "Save ENUM"}
                        </ActionButton>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableList({
  label,
  tables,
  current,
  onPick
}: {
  label: string;
  tables: SupabaseTable[];
  current: string | null;
  onPick: (name: string) => void;
}) {
  if (tables.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <h4 className="px-4 pb-1 pt-2 text-tiny font-medium uppercase tracking-wide text-default-500">
        {label} ({tables.length})
      </h4>
      <ul className="flex flex-col gap-0.5" aria-label={label}>
        {tables.map((t) => (
          <li key={t.name}>
            <button
              type="button"
              aria-current={t.name === current}
              onClick={() => onPick(t.name)}
              className={`w-full truncate rounded-full px-4 py-2 text-left font-mono text-small transition-colors duration-300 ${t.name === current ? "bg-default-100 text-foreground" : "text-default-600 hover:bg-default-50"}`}
            >
              {t.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const byName = (a: SupabaseTable, b: SupabaseTable) => a.name.localeCompare(b.name);

/** Pill tabs to switch between fetched schemas (shown only when there is more than one). */
function SchemaTabs({
  schemas,
  current,
  onPick
}: {
  schemas: SupabaseSchemaEntry[];
  current: string;
  onPick: (schema: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Database schemas"
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-default-100 p-1"
    >
      {schemas.map((s) => (
        <button
          key={s.schema}
          type="button"
          role="tab"
          aria-selected={s.schema === current}
          onClick={() => onPick(s.schema)}
          className={
            "whitespace-nowrap rounded-full px-3 py-1 font-mono text-tiny transition-colors duration-300 " +
            (s.schema === current
              ? "bg-default-300 font-medium text-foreground"
              : "text-default-600 hover:text-foreground")
          }
        >
          {s.schema} ({s.tables.length})
        </button>
      ))}
    </div>
  );
}

/** Tables and views (A to Z, grouped), with the columns of the chosen one. */
export function TablesCard({ model }: { model: SupabasePageModel }) {
  const structure = model.data?.schema?.structure ?? null;
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [schemaName, setSchemaName] = useState<string | null>(null);
  const schemas = structure?.schemas ?? [];
  const entry = schemas.find((s) => s.schema === schemaName) ?? schemas[0] ?? null;
  const all = useMemo(() => entry?.tables ?? [], [entry]);
  const { tables, views } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = (q ? all.filter((t) => t.name.toLowerCase().includes(q)) : all)
      .slice()
      .sort(byName);
    return {
      tables: shown.filter((t) => t.kind === "table"),
      views: shown.filter((t) => t.kind === "view")
    };
  }, [all, query]);
  const table = all.find((t) => t.name === chosen) ?? tables[0] ?? views[0] ?? null;

  return (
    <SupabaseCard
      title="Tables & Views"
      description="Fetched table schema from the connection."
      className="max-h-[700px]"
    >
      {!structure ? (
        <p className="text-small text-default-500">Fetch the schema to see the tables and views.</p>
      ) : (
        <>
          {schemas.length > 1 && entry ? (
            <SchemaTabs
              schemas={schemas}
              current={entry.schema}
              onPick={(name) => {
                setSchemaName(name);
                setChosen(null);
                setQuery("");
              }}
            />
          ) : null}
          {all.length === 0 ? (
            <p className="text-small text-default-500">
              The anon key sees no tables or views in this schema. Expose the schema in the Supabase
              API settings and grant the anon role access, then fetch again.
            </p>
          ) : (
            <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
              <div className="flex min-h-0 w-full shrink-0 flex-col gap-2 md:w-72">
                <FormInput
                  aria-label="Search table or view"
                  placeholder="Search table or view"
                  value={query}
                  onValueChange={setQuery}
                  startContent={<Icon name="ph:magnifying-glass" width={16} height={16} />}
                />
                <div className="min-h-0 overflow-y-auto">
                  <TableList
                    label="Tables"
                    tables={tables}
                    current={table?.name ?? null}
                    onPick={setChosen}
                  />
                  <TableList
                    label="Views"
                    tables={views}
                    current={table?.name ?? null}
                    onPick={setChosen}
                  />
                  {tables.length + views.length === 0 ? (
                    <p className="px-4 py-2 text-small text-default-500">Nothing matches.</p>
                  ) : null}
                </div>
              </div>
              {table ? <TableDetail key={`${entry?.schema}.${table.name}`} table={table} /> : null}
            </div>
          )}
        </>
      )}
    </SupabaseCard>
  );
}
