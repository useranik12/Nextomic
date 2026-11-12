"use client";

import { splitListText, tagText } from "@nextomic/schema";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/lib/icons/Icon";
import { DynamicBolt } from "../right-panel/dynamic-bolt";

// The compare value of "is in list" / "is not in list" as grey chips. A comma (outside a tag) or
// Enter turns the typed text into a chip; Backspace in the empty field removes the last chip
// whole; double-click (or Enter on a focused chip) edits it, Enter saves and Escape cancels. The
// value stays comma separated text, the format the condition reads.

/** Chips before the last comma outside a {{ tag }}, and the text after it. */
function takeChips(text: string): { chips: string[]; rest: string } {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < text.length; i += 1) {
    const pair = text.slice(i, i + 2);
    if (pair === "{{" || pair === "}}") {
      depth = Math.max(0, depth + (pair === "{{" ? 1 : -1));
      i += 1;
    } else if (text[i] === "," && depth === 0) cut = i;
  }
  if (cut < 0) return { chips: [], rest: text };
  return { chips: splitListText(text.slice(0, cut)), rest: text.slice(cut + 1).trimStart() };
}

const chipClass =
  "flex max-w-full items-center gap-0.5 rounded-full bg-default-hover py-0.5 pl-2 pr-0.5 text-xs text-body";

export function ListChipsInput({
  label,
  value,
  description,
  onValueChange
}: {
  label: string;
  value: string;
  description?: string;
  onValueChange: (value: string) => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const items = splitListText(value);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const save = (next: string[]) => onValueChange(next.join(", "));

  const type = (text: string) => {
    const { chips, rest } = takeChips(text);
    if (chips.length > 0) save([...items, ...chips]);
    setDraft(rest);
  };
  const commitDraft = () => {
    const more = splitListText(draft);
    if (more.length > 0) save([...items, ...more]);
    setDraft("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && items.length > 0) {
      event.preventDefault();
      save(items.slice(0, -1));
    }
  };
  const commitEdit = () => {
    if (!editing) return;
    save(items.flatMap((item, i) => (i === editing.index ? splitListText(editing.text) : [item])));
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="pb-0.5 text-xs font-medium text-body">
        {label}
      </label>
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) field.current?.focus();
        }}
        className="flex min-h-8 flex-wrap items-center gap-1 rounded-2xl border border-border px-2 py-1 transition-colors hover:border-default-400 focus-within:border-focus focus-within:ring-1 focus-within:ring-focus/30"
      >
        {items.map((item, index) =>
          editing?.index === index ? (
            <input
              key={`edit-${index}`}
              autoFocus
              aria-label={`Edit ${item}`}
              value={editing.text}
              size={Math.max(4, editing.text.length)}
              onChange={(e) => setEditing({ index, text: e.target.value })}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditing(null);
                }
              }}
              className="rounded-full bg-default px-2 py-0.5 text-xs text-foreground outline-none ring-1 ring-default-400"
            />
          ) : (
            <span key={`${index}-${item}`} className={chipClass}>
              <button
                type="button"
                title="Double-click to edit"
                onDoubleClick={() => setEditing({ index, text: item })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setEditing({ index, text: item });
                  }
                }}
                className="truncate rounded-full outline-none focus-visible:ring-1 focus-visible:ring-focus/30"
              >
                {item}
              </button>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                // Keep focus in the field: a blur would save the typed text with the old chips.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => save(items.filter((_, i) => i !== index))}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-default-300 hover:text-foreground"
              >
                <Icon name="ph:x" width={10} height={10} />
              </button>
            </span>
          )
        )}
        <input
          ref={field}
          id={id}
          value={draft}
          placeholder={items.length === 0 ? "Type a value, then a comma" : ""}
          onChange={(e) => type(e.target.value)}
          onKeyDown={onKey}
          onBlur={commitDraft}
          className="h-6 min-w-[6rem] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle"
        />
        <DynamicBolt label={label} onInsert={(token) => save([...items, tagText(token)])} />
      </div>
      {description ? <p className="text-xs text-muted">{description}</p> : null}
    </div>
  );
}
