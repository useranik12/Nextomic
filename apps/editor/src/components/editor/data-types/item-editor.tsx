"use client";

import { appEnumSchema, dataTypeSchema, type AppEnum, type DataType } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { DraftActions, DraftScope } from "../draft-scope";
import { compactFieldClass } from "../right-panel/setting-row";
import { DataTypeEditor } from "./data-type-editor";
import { EnumEditor } from "./enum-editor";
import { IdentifierInput } from "./identifier-input";

export type Item = DataType | AppEnum;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * One enum or data type: name, description and its values or fields. Edits are a draft until
 * Save (or the guard dialog) puts them into the project.
 */
export function ItemEditor({
  saved,
  taken,
  onSave,
  onDelete
}: {
  saved: Item;
  /** Names of the other items of the same kind. */
  taken: string[];
  onSave: (next: Item) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = draft ?? saved;
  const dirty = draft !== null && !sameJson(draft, saved);
  const isType = "fields" in item;
  const label = `${isType ? "data type" : "enum"} ${saved.name}`;

  function save(): boolean {
    if (!draft) return true;
    const parsed = ("fields" in draft ? dataTypeSchema : appEnumSchema).safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid entry.");
      return false;
    }
    setError(null);
    onSave(parsed.data as Item);
    setDraft(null);
    return true;
  }
  const discard = () => {
    setDraft(null);
    setError(null);
  };

  return (
    <DraftScope label={label} dirty={dirty} onSave={save} onDiscard={discard}>
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-full bg-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {isType ? "Data type" : "Enum"}
            </span>
            <h2 className="truncate font-mono text-base font-semibold text-foreground">
              {item.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <DraftActions label={label} dirty={dirty} onSave={save} onDiscard={discard} />
            <span className="h-5 w-px bg-border" />
            <ActionButton size="sm" tone="danger-ghost" className="h-7 px-2.5" onPress={onDelete}>
              <Icon name="ph:trash" width={14} height={14} />
              Delete
            </ActionButton>
          </div>
        </div>
        <section className="grid gap-3 rounded-2xl border border-separator bg-surface/40 p-4 md:grid-cols-[minmax(12rem,20rem)_1fr]">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Name</span>
            <IdentifierInput
              label={isType ? "Data type name" : "Enum name"}
              value={item.name}
              taken={taken}
              onCommit={(name) => setDraft({ ...item, name })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Description</span>
            <input
              value={item.description}
              maxLength={300}
              placeholder="What it is for"
              onChange={(e) => setDraft({ ...item, description: e.target.value })}
              className={compactFieldClass}
            />
          </label>
        </section>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <section className="rounded-2xl border border-separator bg-surface/40 p-4">
          {"fields" in item ? (
            <DataTypeEditor value={item} onChange={setDraft} />
          ) : (
            <EnumEditor value={item} onChange={setDraft} />
          )}
        </section>
      </div>
    </DraftScope>
  );
}
