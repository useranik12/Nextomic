"use client";

import type { Completion } from "@nextomic/schema";
import { Fragment, useEffect, useRef } from "react";
import { Icon } from "@/lib/icons/Icon";

const KIND_BADGE: Record<Completion["kind"], { text: string; tone: string }> = {
  field: { text: "F", tone: "bg-accent/15 text-accent" },
  method: { text: "M", tone: "bg-default text-muted" },
  property: { text: "P", tone: "bg-default text-muted" },
  function: { text: "ƒ", tone: "bg-warning/15 text-warning" },
  namespace: { text: "N", tone: "bg-warning/15 text-warning" },
  variable: { text: "V", tone: "bg-success/15 text-success" }
};

export interface PanelResult {
  text: string;
  error: boolean;
}

/**
 * The expression suggestions: a small search, the names grouped under headings on the left, and
 * for the active one what it does, its signature and an example. Clicking never takes focus from
 * the field except in the search box.
 */
export function ExpressionPanel({
  items,
  active,
  result,
  search,
  style,
  onSearch,
  onSearchKey,
  onHover,
  onPick
}: {
  items: Completion[];
  active: number;
  result: PanelResult | null;
  search: string;
  style: React.CSSProperties;
  onSearch: (text: string) => void;
  onSearchKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const current = items[active];
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div
      role="dialog"
      aria-label="Expression suggestions"
      data-expression-panel
      style={style}
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
      className="fixed z-[1900] flex w-[34rem] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface text-sm shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-secondary/60 px-2 py-1.5">
        <Icon name="ph:magnifying-glass" width={12} height={12} className="shrink-0 text-subtle" />
        <input
          aria-label="Search suggestions"
          placeholder="Search methods and names"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={onSearchKey}
          className="h-6 min-w-0 flex-1 bg-transparent text-xs text-body outline-none placeholder:text-subtle"
        />
        <span className="shrink-0 text-[10px] text-subtle">{items.length} results</span>
      </div>
      {items.length > 0 ? (
        <div className="flex max-h-72 min-h-0">
          <ul
            ref={list}
            role="listbox"
            aria-label="Suggestions"
            className="w-56 shrink-0 overflow-y-auto border-r border-border pb-1"
          >
            {items.map((item, i) => (
              <Fragment key={`${item.group}-${item.kind}-${item.label}`}>
                {item.group !== items[i - 1]?.group ? (
                  <li
                    role="presentation"
                    className="sticky top-0 z-10 bg-surface/95 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-subtle backdrop-blur"
                  >
                    {item.group}
                  </li>
                ) : null}
                <li
                  role="option"
                  data-index={i}
                  aria-selected={i === active}
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onPick(i)}
                  className={
                    "mx-1 flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 font-mono text-xs transition-colors " +
                    (i === active
                      ? "bg-default-hover text-foreground"
                      : "text-body hover:bg-default")
                  }
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-semibold ${KIND_BADGE[item.kind].tone}`}
                  >
                    {KIND_BADGE[item.kind].text}
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </li>
              </Fragment>
            ))}
          </ul>
          {current ? (
            <div className="min-w-0 flex-1 overflow-y-auto bg-surface-secondary/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                {current.group}
              </p>
              <p className="mt-1 break-words font-mono text-xs text-foreground">
                {current.label}
                <span className="text-muted">{current.detail ? ` ${current.detail}` : ""}</span>
              </p>
              {current.description ? (
                <p className="mt-2 text-xs leading-relaxed text-body">{current.description}</p>
              ) : null}
              {current.example ? (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-border bg-surface p-2 font-mono text-[11px] text-body">
                  {current.example}
                </pre>
              ) : null}
              <p className="mt-3 text-[10px] text-subtle">
                ↑ ↓ move · Enter or Tab insert · Esc close
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-3 py-3 text-xs text-muted">
          {search ? `Nothing matches “${search}”.` : "No suggestions here."}
        </p>
      )}
      {result ? (
        <div
          className={
            "flex gap-2 border-t border-border bg-surface-secondary/60 px-3 py-1.5 font-mono text-xs " +
            (result.error ? "text-danger" : "text-body")
          }
        >
          <span className="shrink-0 text-subtle">Result</span>
          <span className="min-w-0 break-words">
            {result.text || <span className="text-subtle">(empty)</span>}
          </span>
        </div>
      ) : null}
    </div>
  );
}
