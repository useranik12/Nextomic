"use client";

import { ActionButton, CheckField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";

/**
 * Select all and deselect all for a manager list, with the bulk Delete button. Delete appears only
 * while something is selected. `total` counts the rows that can be selected in the current view.
 */
export function SelectionBar({
  noun,
  total,
  selected,
  onSelectAll,
  onClear,
  onDelete
}: {
  /** Plural name for labels, for example "variables". */
  noun: string;
  total: number;
  selected: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const all = total > 0 && selected >= total;

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      <CheckField
        isSelected={all}
        isIndeterminate={selected > 0 && !all}
        isDisabled={total === 0}
        onChange={() => (all ? onClear() : onSelectAll())}
        aria-label={`Select all ${noun}`}
        label="Select all"
      />
      {selected > 0 ? (
        <>
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl px-2 py-1 text-xs text-body hover:bg-default"
          >
            Deselect all
          </button>
          <span className="text-xs text-muted" role="status">
            {selected} selected
          </span>
          <ActionButton size="sm" tone="danger" className="ml-auto" onPress={onDelete}>
            <Icon name="ph:trash" width={14} height={14} />
            Delete {selected}
          </ActionButton>
        </>
      ) : null}
    </div>
  );
}
