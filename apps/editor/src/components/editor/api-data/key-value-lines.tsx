"use client";

import { parseHeaderLine } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { DynamicBolt } from "../right-panel/dynamic-bolt";

export interface KeyValue {
  key: string;
  value: string;
}

export type LineKind = "header" | "field";

/** Reads `key: value`; headers also need a valid header name. */
function readLine(line: string, kind: LineKind): { item: KeyValue } | { error: string } {
  if (kind === "header") {
    const parsed = parseHeaderLine(line);
    return "error" in parsed ? parsed : { item: parsed.header };
  }
  const at = line.indexOf(":");
  if (at <= 0) return { error: "Write the field as key: value." };
  return { item: { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() } };
}

const lineOf = (item: KeyValue) => `${item.key}: ${item.value}`;

/** One saved line: edit in place (applies on blur or Enter), X clears it, empty removes it. */
function Line({
  item,
  kind,
  label,
  onChange,
  onRemove
}: {
  item: KeyValue;
  kind: LineKind;
  label: string;
  onChange: (next: KeyValue) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(lineOf(item));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(lineOf(item)), [item]);

  const commit = () => {
    if (draft.trim() === "") return onRemove();
    const read = readLine(draft, kind);
    if ("error" in read) return setError(read.error);
    setError(null);
    if (lineOf(read.item) !== lineOf(item)) onChange(read.item);
  };

  return (
    <div className="flex items-start gap-1.5">
      <FormInput
        compact
        isClearable
        aria-label={label}
        value={draft}
        isInvalid={error !== null}
        errorMessage={error ?? undefined}
        onValueChange={(v) => {
          setDraft(v);
          setError(null);
        }}
        onClear={onRemove}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="font-mono"
      />
      <div className="pt-1">
        <DynamicBolt label={label} onInsert={(token) => setDraft((d) => `${d}{{${token}}}`)} />
      </div>
    </div>
  );
}

/** Lines of `key: value` (headers, form fields) with an add field and button. */
export function KeyValueLines({
  title,
  kind,
  items,
  onChange,
  addPlaceholder,
  addLabel
}: {
  title: string;
  kind: LineKind;
  items: KeyValue[];
  onChange: (next: KeyValue[]) => void;
  addPlaceholder: string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (draft.trim() === "") return;
    const read = readLine(draft, kind);
    if ("error" in read) return setError(read.error);
    onChange([...items, read.item]);
    setDraft("");
    setError(null);
  };

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-large border border-default-200 p-5"
    >
      <h3 className="text-small font-medium text-foreground">{title}</h3>
      {items.map((item, i) => (
        <Line
          key={`${i}-${item.key}`}
          item={item}
          kind={kind}
          label={`${title} line ${i + 1}`}
          onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))}
          onRemove={() => onChange(items.filter((_, j) => j !== i))}
        />
      ))}
      <FormInput
        compact
        aria-label={addPlaceholder}
        placeholder={addPlaceholder}
        value={draft}
        isInvalid={error !== null}
        errorMessage={error ?? undefined}
        onValueChange={(v) => {
          setDraft(v);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
        className="font-mono"
      />
      <ActionButton
        size="sm"
        tone="ghost"
        className="self-start border border-default-200"
        isDisabled={draft.trim() === ""}
        onPress={add}
      >
        <Icon name="ph:plus-circle" width={14} height={14} />
        {addLabel}
      </ActionButton>
    </section>
  );
}
