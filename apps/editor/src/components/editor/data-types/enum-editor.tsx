"use client";

import type { AppEnum } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";

/** The values of an enum: one per row, in order, each used once. */
export function EnumEditor({
  value,
  onChange
}: {
  value: AppEnum;
  onChange: (next: AppEnum) => void;
}) {
  const [draft, setDraft] = useState("");
  const duplicate = value.values.includes(draft.trim());
  const add = () => {
    const next = draft.trim();
    if (!next || duplicate) return;
    onChange({ ...value, values: [...value.values, next] });
    setDraft("");
  };
  const move = (index: number, by: number) => {
    const values = [...value.values];
    const [item] = values.splice(index, 1);
    if (item === undefined) return;
    values.splice(index + by, 0, item);
    onChange({ ...value, values });
  };
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-small font-semibold">Values</h3>
      {value.values.length === 0 ? (
        <p className="text-small text-default-500">
          No values yet. An enum is a fixed list of choices, such as small, medium and large.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {value.values.map((v, i) => (
            <li key={v} className="flex items-center gap-2">
              <span className="w-6 text-right text-tiny text-default-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate rounded-full border border-default-200 px-3 py-1 font-mono text-small">
                {v}
              </span>
              <button
                type="button"
                aria-label={`Move ${v} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-100 disabled:opacity-30"
              >
                <Icon name="ph:caret-up" width={14} height={14} />
              </button>
              <button
                type="button"
                aria-label={`Move ${v} down`}
                disabled={i === value.values.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-100 disabled:opacity-30"
              >
                <Icon name="ph:caret-down" width={14} height={14} />
              </button>
              <button
                type="button"
                aria-label={`Delete value ${v}`}
                onClick={() => onChange({ ...value, values: value.values.filter((x) => x !== v) })}
                className="flex h-8 w-8 items-center justify-center rounded-full text-danger transition-colors duration-300 hover:bg-danger/10"
              >
                <Icon name="ph:trash" width={16} height={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 max-w-sm flex-1">
          <input
            aria-label="New enum value"
            placeholder="New value"
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            className={`${compactFieldClass} font-mono ${duplicate ? "!border-danger" : ""}`}
          />
          {duplicate ? (
            <p role="alert" className="mt-0.5 px-2 text-tiny text-danger">
              That value is already in the list.
            </p>
          ) : null}
        </div>
        <ActionButton size="sm" tone="ghost" className="border border-default-300" onPress={add}>
          <Icon name="ph:plus" width={14} height={14} />
          Add Value
        </ActionButton>
      </div>
    </div>
  );
}
