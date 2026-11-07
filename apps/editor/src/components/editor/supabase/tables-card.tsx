"use client";

import { STATE_TYPE_LABELS, type SupabaseColumn, type SupabaseTable } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { SupabaseCard } from "./supabase-page";
import type { SupabasePageModel } from "./use-supabase-page";

const typeLabel = (c: SupabaseColumn) => `${STATE_TYPE_LABELS[c.type]}${c.isList ? " list" : ""}`;

function ColumnRow({
  column,
  starred,
  onStar
}: {
  column: SupabaseColumn;
  starred: boolean;
  onStar: () => void;
}) {
  return (
    <tr className="border-b border-divider last:border-b-0">
      <td className="py-2 pr-3">
        <span className="flex items-center gap-2 text-primary">
          {column.primaryKey ? (
            <Icon name="ph:key" label="Primary key" width={16} height={16} />
          ) : (
            <button
              type="button"
              onClick={onStar}
              aria-pressed={starred}
              aria-label={`${starred ? "Unstar" : "Star"} ${column.name}`}
              className="rounded-small text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {starred ? (
                <Icon name="ph:star-fill" width={16} height={16} />
              ) : (
                <Icon name="ph:star" width={16} height={16} />
              )}
            </button>
          )}
          <span className="font-mono text-small">{column.name}</span>
          {column.references ? (
            <span className="text-tiny text-default-500" title={`Points to ${column.references}`}>
              → {column.references}
            </span>
          ) : null}
        </span>
      </td>
      <td className="py-2 pr-3 text-small text-default-600">
        {typeLabel(column)}
        {column.enumValues ? (
          <span className="block text-tiny text-default-500">{column.enumValues.join(", ")}</span>
        ) : null}
      </td>
      <td className="py-2 font-mono text-small text-default-600">
        {column.pgType}
        {column.nullable ? null : <span className="ml-1 text-tiny text-default-500">not null</span>}
      </td>
    </tr>
  );
}

function TableDetail({
  table,
  favorites,
  onStar
}: {
  table: SupabaseTable;
  favorites: string[];
  onStar: (column: string, starred: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-medium font-semibold text-foreground">{table.name}</h3>
        <span className="rounded-full bg-default-100 px-2 py-0.5 text-tiny text-default-600">
          {table.kind === "view" ? "View (read only)" : "Table"}
        </span>
      </div>
      {table.description ? (
        <p className="text-small text-default-500">{table.description}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="text-small text-default-500">
              <th className="pb-2 font-normal">Field Name</th>
              <th className="pb-2 font-normal">Data Type</th>
              <th className="pb-2 font-normal">PostgreSQL Type</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column) => (
              <ColumnRow
                key={column.name}
                column={column}
                starred={favorites.includes(column.name)}
                onStar={() => onStar(column.name, !favorites.includes(column.name))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Searchable list of fetched tables and views, with the columns of the chosen one. */
export function TablesCard({ model }: { model: SupabasePageModel }) {
  const structure = model.data?.schema?.structure ?? null;
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tables = useMemo(() => structure?.tables ?? [], [structure]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tables.filter((t) => t.name.toLowerCase().includes(q)) : tables;
  }, [tables, query]);
  const table = tables.find((t) => t.name === chosen) ?? shown[0] ?? null;

  async function star(column: string, starred: boolean) {
    if (!table) return;
    setError(await model.setFavorite(table.name, column, starred));
  }

  return (
    <SupabaseCard title="Tables & Views" description="Fetched table schema from the connection.">
      {!structure ? (
        <p className="text-small text-default-500">Fetch the schema to see the tables and views.</p>
      ) : tables.length === 0 ? (
        <p className="text-small text-default-500">
          The anon key sees no tables or views. Grant the anon role access in Supabase, then fetch
          again.
        </p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-2 md:w-72">
            <FormInput
              aria-label="Search table or view"
              placeholder="Search table or view"
              value={query}
              onValueChange={setQuery}
              startContent={<Icon name="ph:magnifying-glass" width={16} height={16} />}
            />
            <ul
              className="flex max-h-[28rem] flex-col gap-0.5 overflow-y-auto"
              aria-label="Tables and views"
            >
              {shown.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    aria-current={t.name === table?.name}
                    onClick={() => setChosen(t.name)}
                    className={`flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left text-small transition-colors duration-300 ${t.name === table?.name ? "bg-default-100 text-foreground" : "text-default-600 hover:bg-default-50"}`}
                  >
                    <span className="truncate font-mono">{t.name}</span>
                    {t.kind === "view" ? (
                      <span className="text-tiny text-default-500">view</span>
                    ) : null}
                  </button>
                </li>
              ))}
              {shown.length === 0 ? (
                <li className="px-4 py-2 text-small text-default-500">Nothing matches.</li>
              ) : null}
            </ul>
          </div>
          {table ? (
            <TableDetail
              table={table}
              favorites={structure.favorites[table.name] ?? []}
              onStar={(c, s) => void star(c, s)}
            />
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </SupabaseCard>
  );
}
