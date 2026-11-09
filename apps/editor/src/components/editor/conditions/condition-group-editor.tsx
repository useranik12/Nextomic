"use client";

import {
  countConditions,
  isConditionGroup,
  MAX_CONDITION_DEPTH,
  MAX_CONDITIONS,
  type Condition,
  type ConditionGroup
} from "@nextomic/schema";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { ConditionRow } from "./condition-row";

// A condition group: All (AND) or Any (OR) of its conditions and inner groups. Groups nest up to
// MAX_CONDITION_DEPTH levels; the whole tree holds at most MAX_CONDITIONS conditions.

const MATCH_OPTIONS = [
  { value: "all", label: "All of these are true (AND)" },
  { value: "any", label: "Any of these is true (OR)" }
];

export const newCondition = (): Condition => ({
  id: crypto.randomUUID(),
  left: "",
  op: "equals",
  right: ""
});

export function ConditionGroupEditor({
  group,
  depth,
  total,
  onChange,
  onRemove
}: {
  group: ConditionGroup;
  /** 1 for the top group. */
  depth: number;
  /** Conditions in the whole tree (for the limit). */
  total: number;
  onChange: (next: ConditionGroup) => void;
  /** Removes this group (inner groups only). */
  onRemove?: () => void;
}) {
  const full = total >= MAX_CONDITIONS;
  const setItem = (i: number, item: Condition | ConditionGroup) =>
    onChange({ ...group, items: group.items.map((x, j) => (j === i ? item : x)) });
  const removeItem = (i: number) =>
    onChange({ ...group, items: group.items.filter((_, j) => j !== i) });

  return (
    <div
      className={
        "flex flex-col gap-2 " +
        (depth > 1 ? "rounded-large border border-dashed border-default-300 p-2.5" : "")
      }
    >
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <SelectField
            compact
            label={depth > 1 ? "Inner group match" : "Match"}
            hideLabel
            options={MATCH_OPTIONS}
            value={group.match}
            onValueChange={(match) => onChange({ ...group, match: match as "all" | "any" })}
          />
        </div>
        {onRemove ? (
          <button
            type="button"
            aria-label="Remove group"
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-100 hover:text-danger"
          >
            <Icon name="ph:trash" width={14} height={14} />
          </button>
        ) : null}
      </div>
      {group.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {group.items.map((item, i) =>
            isConditionGroup(item) ? (
              <li key={item.id}>
                <ConditionGroupEditor
                  group={item}
                  depth={depth + 1}
                  total={total}
                  onChange={(next) => setItem(i, next)}
                  onRemove={() => removeItem(i)}
                />
              </li>
            ) : (
              <ConditionRow
                key={item.id}
                condition={item}
                onChange={(next) => setItem(i, next)}
                onRemove={() => removeItem(i)}
              />
            )
          )}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          tone="ghost"
          size="sm"
          isDisabled={full}
          startContent={<Icon name="ph:plus" width={14} height={14} />}
          onPress={() => onChange({ ...group, items: [...group.items, newCondition()] })}
        >
          Add condition
        </ActionButton>
        {depth < MAX_CONDITION_DEPTH ? (
          <ActionButton
            tone="ghost"
            size="sm"
            isDisabled={full}
            startContent={<Icon name="ph:brackets-round" width={14} height={14} />}
            onPress={() =>
              onChange({
                ...group,
                items: [
                  ...group.items,
                  { id: crypto.randomUUID(), match: "any", items: [newCondition()] }
                ]
              })
            }
          >
            Add group
          </ActionButton>
        ) : null}
      </div>
      {full && depth === 1 ? (
        <p role="status" className="text-tiny text-warning">
          {countConditions(group)} conditions is the most an element can have.
        </p>
      ) : null}
    </div>
  );
}
