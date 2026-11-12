"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RULE_FIELDS, ruleFieldById, type RuleFieldDef } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";

/** Fields grouped in their declared order. */
function grouped(fields: readonly RuleFieldDef[]): [string, RuleFieldDef[]][] {
  const groups = new Map<string, RuleFieldDef[]>();
  for (const field of fields) groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
  return [...groups.entries()];
}

/**
 * Chooses what a rule looks at. The button shows the whole name (it wraps instead of cutting off),
 * and the list is grouped and searchable.
 */
export function FieldPicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (field: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = ruleFieldById(value);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grouped(
      q === ""
        ? RULE_FIELDS
        : RULE_FIELDS.filter((f) => `${f.group} ${f.label}`.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      placement="bottom-start"
      offset={6}
      // Focusing the search box can scroll a modal or panel; that must not close the list.
      shouldCloseOnScroll={false}
    >
      <PopoverTrigger>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="listbox"
          className="flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-default-300 px-2.5 py-1 text-left text-sm text-foreground transition-colors duration-300 hover:border-default-400 focus-visible:ring-1 focus-visible:ring-focus/30"
        >
          <span className="min-w-0 whitespace-normal break-words">
            <span className="block text-xs leading-tight text-muted">
              {current?.group ?? "Choose"}
            </span>
            <span className="block leading-tight">{current?.label ?? value}</span>
          </span>
          <Icon name="ph:caret-down" width={14} height={14} className="shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 items-stretch gap-2 p-2">
        <div className="relative">
          <Icon
            name="ph:magnifying-glass"
            width={14}
            height={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            autoFocus
            aria-label={`Search ${label}`}
            placeholder="Search conditions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-xl border border-default-300 bg-transparent pl-8 pr-2 text-sm outline-none focus:border-default-500"
          />
        </div>
        <div role="listbox" aria-label={label} className="max-h-72 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">No condition matches.</p>
          ) : (
            groups.map(([group, fields]) => (
              <div key={group} role="group" aria-label={group} className="pb-1">
                <p className="px-2 pb-0.5 pt-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  {group}
                </p>
                {fields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    role="option"
                    aria-selected={field.id === value}
                    onClick={() => {
                      onChange(field.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={
                      "flex w-full items-start justify-between gap-2 whitespace-normal break-words rounded-xl px-2 py-1.5 text-left text-sm transition-colors duration-300 hover:bg-default-hover " +
                      (field.id === value ? "bg-default text-foreground" : "text-body")
                    }
                  >
                    {field.label}
                    {field.id === value ? (
                      <Icon name="ph:check" width={14} height={14} className="mt-0.5 shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
