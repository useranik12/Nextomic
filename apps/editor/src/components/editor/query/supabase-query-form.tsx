"use client";

import {
  findTable,
  operatorsFor,
  tableRef,
  type QueryFilter,
  type QueryOrder,
  type SupabaseLoopQuery,
  type SupabaseStructure
} from "@nextomic/schema";
import { ActionButton } from "@/components/ui/controls";
import { LabelWithTip } from "@/components/ui/info-tip";
import { SearchSelect, type SearchSelectSection } from "@/components/ui/search-select";
import { SwitchRow } from "@/components/ui/switch-row";
import { QueryFilterRow } from "./query-filter-row";
import { useQueryFormMode } from "./query-form-mode";
import { QueryOrderRow } from "./query-order-row";
import { RowSettings } from "./row-settings";

// Supabase settings of a query loop: the table or view, rows, filters, order, realtime.

const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

function tableSections(structure: SupabaseStructure | null): SearchSelectSection[] {
  const all = (structure?.schemas ?? []).flatMap((s) =>
    s.tables.map((t) => ({
      kind: t.kind,
      value: `${s.schema}/${t.name}`,
      label: tableRef(s.schema, t.name)
    }))
  );
  const of = (kind: "table" | "view") =>
    all
      .filter((t) => t.kind === kind)
      .map(({ value, label }) => ({ value, label }))
      .sort(byName);
  return [
    { title: "Tables", options: of("table") },
    { title: "Views", options: of("view") }
  ];
}

export function SupabaseQueryForm({
  value,
  structure,
  onChange
}: {
  value: SupabaseLoopQuery;
  structure: SupabaseStructure | null;
  onChange: (next: SupabaseLoopQuery) => void;
}) {
  const mode = useQueryFormMode();
  const table = findTable(structure, value.schema, value.table);
  const columns = table?.columns ?? [];
  const patch = (next: Partial<SupabaseLoopQuery>) => onChange({ ...value, ...next });

  const chooseTable = (key: string) => {
    const [schema = "public", name = ""] = key.split("/");
    const next = findTable(structure, schema, name);
    const names = new Set(next?.columns.map((c) => c.name));
    patch({
      schema,
      table: name,
      filters: value.filters.filter((f) => names.has(f.column)),
      order: value.order.filter((o) => names.has(o.column))
    });
  };

  const setFilter = (id: string, next: QueryFilter | null) =>
    patch({
      filters: next
        ? value.filters.map((f) => (f.id === id ? next : f))
        : value.filters.filter((f) => f.id !== id)
    });
  const setOrder = (id: string, next: QueryOrder | null) =>
    patch({
      order: next
        ? value.order.map((o) => (o.id === id ? next : o))
        : value.order.filter((o) => o.id !== id)
    });

  const first = columns[0];
  const addFilter = () =>
    first &&
    patch({
      filters: [
        ...value.filters,
        {
          id: crypto.randomUUID(),
          column: first.name,
          operator: operatorsFor(first)[0] ?? "eq",
          value: ""
        }
      ]
    });
  const addOrder = () =>
    first &&
    patch({
      order: [...value.order, { id: crypto.randomUUID(), column: first.name, ascending: true }]
    });

  return (
    <>
      <SearchSelect
        label="Table or view"
        placeholder="Search tables and views"
        sections={tableSections(structure)}
        value={value.table ? `${value.schema}/${value.table}` : ""}
        onValueChange={chooseTable}
        emptyText="No table or view matches."
        tip={mode.tip("table")}
      />
      <RowSettings value={value} onChange={patch} />
      <fieldset className="flex flex-col gap-3" disabled={!table}>
        <legend className="mb-2 text-xs font-medium text-body">
          {mode.tip("filters") ? (
            <LabelWithTip tip={mode.tip("filters") ?? ""}>Filters</LabelWithTip>
          ) : (
            "Filters"
          )}
        </legend>
        {value.filters.length === 0 ? (
          <p className="text-xs text-muted">No filters: every row the anon key can read.</p>
        ) : null}
        {value.filters.map((filter) => (
          <QueryFilterRow
            key={filter.id}
            filter={filter}
            columns={columns}
            onChange={(next) => setFilter(filter.id, next)}
          />
        ))}
        <ActionButton
          size="sm"
          tone="ghost"
          className="self-start"
          isDisabled={!table}
          onPress={addFilter}
        >
          Add filter
        </ActionButton>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={!table}>
        <legend className="mb-2 text-xs font-medium text-body">
          {mode.tip("order") ? (
            <LabelWithTip tip={mode.tip("order") ?? ""}>Order by</LabelWithTip>
          ) : (
            "Order by"
          )}
        </legend>
        {value.order.map((order) => (
          <QueryOrderRow
            key={order.id}
            order={order}
            columns={columns}
            onChange={(next) => setOrder(order.id, next)}
          />
        ))}
        <ActionButton
          size="sm"
          tone="ghost"
          className="self-start"
          isDisabled={!table}
          onPress={addOrder}
        >
          Add order
        </ActionButton>
      </fieldset>
      <SwitchRow
        label="Enable realtime query"
        tip={
          mode.tip("realtime") ??
          "Streams inserts, updates and deletes to the page with Supabase Realtime (anon key). Turn on Realtime for the table in Supabase."
        }
        disabled={mode.refresh}
        selected={value.realtime}
        onChange={(realtime) => patch({ realtime })}
      />
    </>
  );
}
