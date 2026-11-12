"use client";

import { FormInput, SelectField, type SelectOption } from "@/components/ui/controls";

/** Search by name (include and exclude), sort and filter: the bar above the variable and class managers. */
export function ManagerToolbar({
  include,
  exclude,
  onInclude,
  onExclude,
  sort,
  sortOptions,
  onSort,
  filter,
  filterOptions,
  onFilter
}: {
  include: string;
  exclude: string;
  onInclude: (v: string) => void;
  onExclude: (v: string) => void;
  sort: string;
  sortOptions: SelectOption[];
  onSort: (v: string) => void;
  filter: string;
  filterOptions: SelectOption[];
  onFilter: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-border p-3 lg:grid-cols-4">
      <FormInput
        compact
        type="search"
        aria-label="Name (include)"
        placeholder="Name (include)"
        value={include}
        onValueChange={onInclude}
      />
      <FormInput
        compact
        type="search"
        aria-label="Name (exclude)"
        placeholder="Name (exclude)"
        value={exclude}
        onValueChange={onExclude}
      />
      <SelectField
        compact
        hideLabel
        label="Sort"
        options={sortOptions}
        value={sort}
        onValueChange={onSort}
      />
      <SelectField
        compact
        hideLabel
        label="Filter"
        options={filterOptions}
        value={filter}
        onValueChange={onFilter}
      />
    </div>
  );
}
