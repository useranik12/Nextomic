"use client";

import { addTerm, searchTerms, type Taxonomy, type Term } from "@nextomic/schema";
import { useId, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { compactFieldClass } from "./setting-row";

type Scope = "page" | "template";
type TermKind = "category" | "tag";

const LIST: Record<Scope, Record<TermKind, keyof Taxonomy>> = {
  page: { category: "pageCategories", tag: "pageTags" },
  template: { category: "templateCategories", tag: "templateTags" }
};

const CHIP: Record<TermKind, string> = {
  category: "bg-lime-500/20 text-lime-600 dark:text-lime-400",
  tag: "bg-yellow-400/25 text-yellow-700 dark:text-yellow-300"
};

/**
 * A search box over a list of terms. Typing narrows the list by any part of the name. When nothing
 * matches, a plus inside the box creates the term and applies it. Applied terms show as chips.
 */
function TermInput({
  kind,
  label,
  terms,
  selectedIds,
  onSelect,
  onRemove,
  onCreate
}: {
  kind: TermKind;
  label: string;
  terms: readonly Term[];
  selectedIds: readonly string[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const free = terms.filter((t) => !selectedIds.includes(t.id));
  const matches = searchTerms(free, query);
  const text = query.trim();
  const exists = terms.some((t) => t.name.toLowerCase() === text.toLowerCase());
  const canCreate = text !== "" && matches.length === 0 && !exists;
  const applied = selectedIds
    .map((id) => terms.find((t) => t.id === id))
    .filter((t): t is Term => Boolean(t));

  function pick(id: string) {
    onSelect(id);
    setQuery("");
  }
  function create() {
    if (!canCreate) return;
    onCreate(text);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={label}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (matches[0]) pick(matches[0].id);
            else create();
          }}
          className={compactFieldClass + " pr-8"}
        />
        {canCreate ? (
          <button
            type="button"
            aria-label={`Create ${kind} ${text} and apply it`}
            title={`Create "${text}" and apply it`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={create}
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-default-200 text-default-700 hover:bg-default-300 hover:text-foreground"
          >
            <Icon name="ph:plus" width={12} height={12} />
          </button>
        ) : null}
        {open && matches.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} matches`}
            className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-medium border border-divider bg-content1 p-1 shadow-lg"
          >
            {matches.map((t) => (
              <li key={t.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(t.id)}
                  className="w-full rounded-medium px-2 py-1 text-left text-small hover:bg-default-100"
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {applied.length > 0 ? (
        <ul
          className="flex flex-wrap gap-1.5"
          aria-label={`Applied ${kind === "tag" ? "tags" : "categories"}`}
        >
          {applied.map((t) => (
            <li
              key={t.id}
              className={`flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[12px] leading-4 ${CHIP[kind]}`}
            >
              {t.name}
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => onRemove(t.id)}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/15"
              >
                <Icon name="ph:x" width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Marking: categories and tags of the page or template being edited. Pages and templates each
 * have their own lists, and categories never mix with tags.
 */
export function MarkingGroup({
  scope,
  categoryIds,
  tagIds,
  onChange
}: {
  scope: Scope;
  categoryIds: readonly string[];
  tagIds: readonly string[];
  onChange: (change: { categoryIds?: string[]; tagIds?: string[] }) => void;
}) {
  const taxonomy = useEditorStore((s) => s.project.taxonomy);
  const setTaxonomy = useEditorStore((s) => s.setTaxonomy);
  const [open, setOpen] = useState(true);

  function create(kind: TermKind, name: string) {
    const key = LIST[scope][kind];
    const { terms, term } = addTerm(taxonomy[key], name, crypto.randomUUID());
    if (!term) return;
    if (!taxonomy[key].some((t) => t.id === term.id)) setTaxonomy({ ...taxonomy, [key]: terms });
    const current = kind === "category" ? categoryIds : tagIds;
    if (!current.includes(term.id))
      onChange(
        kind === "category"
          ? { categoryIds: [...current, term.id] }
          : { tagIds: [...current, term.id] }
      );
  }

  function field(kind: TermKind, label: string, ids: readonly string[]) {
    const change = (next: string[]) =>
      onChange(kind === "category" ? { categoryIds: next } : { tagIds: next });
    return (
      <TermInput
        kind={kind}
        label={label}
        terms={taxonomy[LIST[scope][kind]]}
        selectedIds={ids}
        onSelect={(id) => change([...ids, id])}
        onRemove={(id) => change(ids.filter((x) => x !== id))}
        onCreate={(name) => create(kind, name)}
      />
    );
  }

  return (
    <section aria-label="Categories and tags" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-small text-default-600">Categories and tags</h3>
        <button
          type="button"
          aria-label={open ? "Collapse categories and tags" : "Expand categories and tags"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1 text-default-600 hover:text-foreground"
        >
          {open ? (
            <Icon name="ph:minus-circle" width={16} height={16} />
          ) : (
            <Icon name="ph:plus" width={16} height={16} />
          )}
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-3">
          {field("category", "Category", categoryIds)}
          {field("tag", "Tags", tagIds)}
        </div>
      ) : null}
    </section>
  );
}
