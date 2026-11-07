"use client";

import type { Completion } from "@nextomic/schema";
import { useEffect, useRef } from "react";

const KIND_BADGE: Record<Completion["kind"], string> = {
  field: "F",
  method: "M",
  property: "P",
  function: "ƒ",
  namespace: "N",
  variable: "V"
};

/**
 * The suggestion list of the expression autocomplete: names on the left, and for the active one
 * what it does, its signature and an example. The pointer never takes focus from the input.
 */
export function ExpressionPanel({
  items,
  active,
  result,
  style,
  onHover,
  onPick
}: {
  items: Completion[];
  active: number;
  result: { text: string; error: boolean } | null;
  style: React.CSSProperties;
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
      style={style}
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[1900] flex w-[34rem] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-large border border-divider bg-content1 text-small shadow-xl"
    >
      {items.length > 0 ? (
        <div className="flex max-h-64 min-h-0">
          <ul
            ref={list}
            role="listbox"
            aria-label="Suggestions"
            className="w-56 shrink-0 overflow-y-auto border-r border-divider p-1"
          >
            {items.map((item, i) => (
              <li
                key={`${item.kind}-${item.label}`}
                role="option"
                data-index={i}
                aria-selected={i === active}
                onMouseEnter={() => onHover(i)}
                onClick={() => onPick(i)}
                className={
                  "flex cursor-pointer items-center gap-2 rounded-medium px-2 py-1 font-mono text-tiny " +
                  (i === active ? "bg-default-200 text-foreground" : "text-default-700")
                }
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-default-100 text-[10px] text-default-500">
                  {KIND_BADGE[item.kind]}
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="min-w-0 flex-1 overflow-y-auto p-3">
              <p className="break-words font-mono text-tiny text-foreground">
                {current.label}
                <span className="text-default-500">
                  {current.detail ? ` ${current.detail}` : ""}
                </span>
              </p>
              {current.description ? (
                <p className="mt-1.5 text-tiny text-default-600">{current.description}</p>
              ) : null}
              {current.example ? (
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-medium bg-default-100 p-2 font-mono text-[11px] text-default-700">
                  {current.example}
                </pre>
              ) : null}
              <p className="mt-2 text-[11px] text-default-400">
                ↑ ↓ to move · Enter or Tab to insert · Esc to close
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {result ? (
        <div
          className={
            "border-t border-divider px-3 py-1.5 font-mono text-tiny " +
            (result.error ? "text-danger" : "text-default-600")
          }
        >
          <span className="text-default-400">Result: </span>
          {result.text || <span className="text-default-400">(empty)</span>}
        </div>
      ) : null}
    </div>
  );
}
