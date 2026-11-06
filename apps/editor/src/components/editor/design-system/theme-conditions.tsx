"use client";

import type { Theme, ThemeCondition } from "@nextomic/schema";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import type { PageSummary } from "@/server/pages";

/** Where a theme applies besides pages that force it: page and route rules (static conditions). */
export function ThemeConditions({
  theme,
  pages,
  onChange
}: {
  theme: Theme;
  pages: readonly PageSummary[];
  onChange: (conditions: Theme["conditions"]) => void;
}) {
  const { match, items } = theme.conditions;
  const set = (next: ThemeCondition[]) => onChange({ match, items: next });
  const update = (index: number, item: ThemeCondition) =>
    set(items.map((c, i) => (i === index ? item : c)));

  if (theme.isDefault) {
    return (
      <p className="text-small text-default-500">
        The default theme applies everywhere no other theme matches. Conditions are not used.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {items.length > 1 ? (
        <SelectField
          compact
          label="Apply when"
          value={match}
          onValueChange={(v) => onChange({ items, match: v === "all" ? "all" : "any" })}
          options={[
            { value: "any", label: "Any rule matches" },
            { value: "all", label: "All rules match" }
          ]}
        />
      ) : null}
      {items.length === 0 ? (
        <p className="text-small text-default-500">
          No rules. This theme only applies to pages that choose it in Page Settings.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-large border border-divider p-3">
          <div className="flex items-center justify-between">
            <span className="text-tiny font-semibold uppercase text-default-500">
              {item.type === "page" ? "Pages" : "Route"}
            </span>
            <button
              type="button"
              aria-label="Remove rule"
              onClick={() => set(items.filter((_, i) => i !== index))}
              className="rounded p-1 text-default-500 hover:text-danger"
            >
              <Icon name="ph:trash" width={14} height={14} />
            </button>
          </div>
          {item.type === "route" ? (
            <FormInput
              compact
              label="Route pattern (* matches anything)"
              placeholder="/blog/*"
              value={item.pattern}
              onValueChange={(pattern) => update(index, { type: "route", pattern })}
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {pages.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 text-small">
                    <input
                      type="checkbox"
                      checked={item.pageIds.includes(p.id)}
                      onChange={(e) =>
                        update(index, {
                          type: "page",
                          pageIds: e.target.checked
                            ? [...item.pageIds, p.id]
                            : item.pageIds.filter((id) => id !== p.id)
                        })
                      }
                    />
                    {p.name} <span className="text-tiny text-default-500">{p.route}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <ActionButton
          size="sm"
          tone="ghost"
          onPress={() => set([...items, { type: "route", pattern: "/" }])}
        >
          Add route rule
        </ActionButton>
        <ActionButton
          size="sm"
          tone="ghost"
          onPress={() => set([...items, { type: "page", pageIds: [] }])}
        >
          Add page rule
        </ActionButton>
      </div>
    </div>
  );
}
