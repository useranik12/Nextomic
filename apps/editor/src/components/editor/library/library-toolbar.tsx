"use client";

import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, type Taxonomy } from "@nextomic/schema";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";
import { DEFAULT_QUERY, type DateField, type LibraryQuery, type SortKey } from "./library-filter";

export type LibraryView = "grid" | "list";

const DATE_FIELDS: { value: DateField; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Updated" },
  { value: "publishedAt", label: "Published" }
];
const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  ...DATE_FIELDS.map((f) => ({ value: f.value, label: `${f.label} date` }))
];

const toggle = (on: boolean) =>
  "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 " +
  (on ? "bg-default-200 text-foreground" : "text-default-600 hover:bg-default-100");

export function LibraryToolbar({
  query,
  onQuery,
  view,
  onView,
  taxonomy,
  counts,
  onCreate
}: {
  query: LibraryQuery;
  onQuery: (change: Partial<LibraryQuery>) => void;
  view: LibraryView;
  onView: (view: LibraryView) => void;
  taxonomy: Taxonomy;
  counts: { pages: number; templates: number };
  onCreate: () => void;
}) {
  const templates = query.tab === "templates";
  const categories = templates ? taxonomy.templateCategories : taxonomy.pageCategories;
  const tags = templates ? taxonomy.templateTags : taxonomy.pageTags;
  const filtered =
    query.text !== "" ||
    query.categoryId !== "all" ||
    query.tagId !== "all" ||
    query.status !== "all" ||
    query.type !== "all" ||
    query.from !== "" ||
    query.to !== "";

  return (
    <div className="flex flex-col gap-3 border-b border-divider p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Pages and templates" className="flex gap-1">
          {(["pages", "templates"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={query.tab === tab}
              onClick={() =>
                onQuery({ tab, text: "", categoryId: "all", tagId: "all", type: "all" })
              }
              className={
                "h-9 rounded-full px-4 text-small font-medium transition-colors duration-300 " +
                (query.tab === tab
                  ? "bg-default-200 text-foreground"
                  : "text-default-600 hover:bg-default-100")
              }
            >
              {tab === "pages" ? "Pages" : "Templates"}{" "}
              <span className="text-tiny text-default-500">{counts[tab]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Layout" className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Grid layout"
              aria-pressed={view === "grid"}
              onClick={() => onView("grid")}
              className={toggle(view === "grid")}
            >
              <Icon name="ph:squares-four" width={18} height={18} />
            </button>
            <button
              type="button"
              aria-label="Column layout"
              aria-pressed={view === "list"}
              onClick={() => onView("list")}
              className={toggle(view === "list")}
            >
              <Icon name="ph:rows" width={18} height={18} />
            </button>
          </div>
          <ActionButton size="sm" onPress={onCreate}>
            <Icon name="ph:plus" width={14} height={14} />
            {templates ? "New template" : "New page"}
          </ActionButton>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-64">
          <Icon
            name="ph:magnifying-glass"
            width={14}
            height={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-default-500"
          />
          <input
            type="search"
            aria-label={`Search ${query.tab}`}
            placeholder={`Search ${query.tab} by name, route, creator or ID`}
            value={query.text}
            onChange={(e) => onQuery({ text: e.target.value })}
            className={compactFieldClass + " pl-8"}
          />
        </div>
        <SelectField
          compact
          label="Category"
          className="w-40"
          value={query.categoryId}
          onValueChange={(categoryId) => onQuery({ categoryId })}
          options={[
            { value: "all", label: "All categories" },
            ...categories.map((t) => ({ value: t.id, label: t.name }))
          ]}
        />
        <SelectField
          compact
          label="Tag"
          className="w-36"
          value={query.tagId}
          onValueChange={(tagId) => onQuery({ tagId })}
          options={[
            { value: "all", label: "All tags" },
            ...tags.map((t) => ({ value: t.id, label: t.name }))
          ]}
        />
        <SelectField
          compact
          label="Status"
          className="w-36"
          value={query.status}
          onValueChange={(status) => onQuery({ status: status as LibraryQuery["status"] })}
          options={[
            { value: "all", label: "Any status" },
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "modified", label: "Modified" }
          ]}
        />
        {templates ? (
          <SelectField
            compact
            label="Type"
            className="w-36"
            value={query.type}
            onValueChange={(type) => onQuery({ type })}
            options={[
              { value: "all", label: "All types" },
              ...TEMPLATE_TYPES.map((t) => ({ value: t, label: TEMPLATE_TYPE_LABELS[t] }))
            ]}
          />
        ) : null}
        <SelectField
          compact
          label="Filter by date of"
          className="w-36"
          value={query.dateField}
          onValueChange={(dateField) => onQuery({ dateField: dateField as DateField })}
          options={DATE_FIELDS}
        />
        <label className="flex flex-col gap-0.5 text-tiny text-default-600">
          From
          <input
            type="date"
            value={query.from}
            max={query.to || undefined}
            onChange={(e) => onQuery({ from: e.target.value })}
            className={compactFieldClass}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-tiny text-default-600">
          To
          <input
            type="date"
            value={query.to}
            min={query.from || undefined}
            onChange={(e) => onQuery({ to: e.target.value })}
            className={compactFieldClass}
          />
        </label>
        <SelectField
          compact
          label="Sort by"
          className="w-40"
          value={query.sort}
          onValueChange={(sort) => onQuery({ sort: sort as SortKey })}
          options={SORTS}
        />
        <button
          type="button"
          aria-label={
            query.descending
              ? "Sorted high to low, switch to low to high"
              : "Sorted low to high, switch to high to low"
          }
          onClick={() => onQuery({ descending: !query.descending })}
          className={toggle(false) + " mb-0.5 border border-default-200"}
        >
          {query.descending ? (
            <Icon name="ph:sort-descending" width={16} height={16} />
          ) : (
            <Icon name="ph:sort-ascending" width={16} height={16} />
          )}
        </button>
        {filtered ? (
          <ActionButton
            size="sm"
            tone="ghost"
            onPress={() =>
              onQuery({
                text: DEFAULT_QUERY.text,
                categoryId: "all",
                tagId: "all",
                status: "all",
                type: "all",
                from: "",
                to: ""
              })
            }
          >
            Clear filters
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}
