"use client";

import { useEffect, useRef } from "react";
import { ActionButton } from "@/components/ui/controls";
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
  const box = useRef<HTMLInputElement>(null);
  const all = total > 0 && selected >= total;
  useEffect(() => {
    if (box.current) box.current.indeterminate = selected > 0 && !all;
  }, [selected, all]);

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-tiny text-default-600">
        <input
          ref={box}
          type="checkbox"
          checked={all}
          disabled={total === 0}
          onChange={() => (all ? onClear() : onSelectAll())}
          aria-label={`Select all ${noun}`}
          className="h-4 w-4 cursor-pointer accent-default-800"
        />
        Select all
      </label>
      {selected > 0 ? (
        <>
          <button
            type="button"
            onClick={onClear}
            className="rounded-medium px-2 py-1 text-tiny text-default-600 hover:bg-default-100"
          >
            Deselect all
          </button>
          <span className="text-tiny text-default-500" role="status">
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
