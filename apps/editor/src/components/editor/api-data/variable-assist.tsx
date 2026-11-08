"use client";

import type { AvailableVariable } from "@nextomic/schema";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placeFloating } from "@/lib/place-floating";
import { replaceInField, type TextField } from "../expression/expression-field";
import { matches, placeholderAt, VariableRow } from "./variable-list";

// API Data fields take only the call's variables, written as [name] (no dynamic data). Typing "["
// adds the "]" and opens a list of the variables (type and default value); ArrowUp/ArrowDown move,
// Enter or Tab insert, Escape closes. One listener on the wrapper serves every field inside it;
// a field inside [data-no-vars] (names, the Variables table) is left alone.

interface Open {
  el: TextField;
  /** The name being typed between "[" and "]", as offsets in the field's value. */
  from: number;
  to: number;
  search: string;
  active: number;
}

const SIZE = { width: 340, maxHeight: 264, row: 44 };
const NAME_CHAR = /[A-Za-z0-9_]/;

function asVariableField(target: EventTarget | null, box: HTMLElement): TextField | null {
  const el =
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && ["text", "url", "search", ""].includes(target.type))
      ? target
      : null;
  return el && box.contains(el) && !el.closest("[data-no-vars]") ? el : null;
}

/** Wraps fields that take `[variable]` placeholders and shows the variable list while typing one. */
export function VariableFields({
  variables,
  children,
  className
}: {
  variables: readonly AvailableVariable[];
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;
  const variablesRef = useRef(variables);
  variablesRef.current = variables;
  // Escape keeps the list closed until the field's text or caret changes.
  const dismissed = useRef("");

  const refresh = useCallback((el: TextField) => {
    const caret = el.selectionStart ?? 0;
    const at = el.selectionStart === el.selectionEnd ? placeholderAt(el.value, caret) : null;
    if (!at || dismissed.current === `${el.value}\u0000${caret}`) return setOpen(null);
    dismissed.current = "";
    setOpen((prev) => ({
      el,
      ...at,
      active: prev && prev.el === el && prev.search === at.search ? prev.active : 0
    }));
  }, []);

  const pick = useCallback((variable: AvailableVariable) => {
    const state = openRef.current;
    if (!state) return;
    setOpen(null);
    const caret = state.from + variable.name.length + 1;
    replaceInField(state.el, state.from, state.to, variable.name, caret);
  }, []);

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const onInput = (e: Event) => {
      const el = asVariableField(e.target, root);
      if (!el) return;
      const caret = el.selectionStart ?? 0;
      // Typing "[" adds the closing "]" and leaves the caret between them.
      if (
        e instanceof InputEvent &&
        e.inputType === "insertText" &&
        e.data === "[" &&
        !NAME_CHAR.test(el.value[caret] ?? "") &&
        el.value[caret] !== "]"
      )
        replaceInField(el, caret, caret, "]", caret);
      refresh(el);
    };
    const onCaret = (e: Event) => {
      if (e instanceof KeyboardEvent && ["ArrowUp", "ArrowDown", "Enter", "Tab"].includes(e.key))
        return;
      const el = asVariableField(e.target, root);
      if (el) refresh(el);
    };
    const onKey = (e: KeyboardEvent) => {
      const state = openRef.current;
      if (!state || e.target !== state.el) return;
      const shown = matches(variablesRef.current, state.search);
      if (e.key === "Escape") {
        dismissed.current = `${state.el.value}\u0000${state.el.selectionStart ?? 0}`;
        setOpen(null);
      } else if (!shown.length) return;
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const step = e.key === "ArrowDown" ? 1 : -1;
        setOpen({ ...state, active: (state.active + step + shown.length) % shown.length });
      } else if (e.key === "Enter" || e.key === "Tab") {
        const variable = shown[Math.min(state.active, shown.length - 1)];
        if (variable) pick(variable);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onBlur = (e: FocusEvent) => {
      if (openRef.current?.el === e.target) setOpen(null);
    };
    root.addEventListener("input", onInput);
    root.addEventListener("keyup", onCaret);
    root.addEventListener("click", onCaret);
    root.addEventListener("keydown", onKey, true);
    root.addEventListener("focusout", onBlur);
    return () => {
      root.removeEventListener("input", onInput);
      root.removeEventListener("keyup", onCaret);
      root.removeEventListener("click", onCaret);
      root.removeEventListener("keydown", onKey, true);
      root.removeEventListener("focusout", onBlur);
    };
  }, [refresh, pick]);

  const shown = open ? matches(variables, open.search) : [];
  const active = open ? Math.max(0, Math.min(open.active, shown.length - 1)) : 0;
  const listed = open !== null && shown.length > 0;

  // The field points screen readers at the highlighted variable; the row stays in view.
  useEffect(() => {
    const el = open?.el;
    if (!el || !listed) return;
    el.setAttribute("aria-controls", "api-variable-list");
    el.setAttribute("aria-activedescendant", `api-variable-${active}`);
    document.getElementById(`api-variable-${active}`)?.scrollIntoView({ block: "nearest" });
    return () => {
      el.removeAttribute("aria-controls");
      el.removeAttribute("aria-activedescendant");
    };
  }, [open?.el, listed, active]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("[data-var-popup]")) return;
      setOpen(null);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  let popup: ReactNode = null;
  if (open && listed && typeof document !== "undefined") {
    const height = Math.min(SIZE.maxHeight, shown.length * SIZE.row + 36);
    const rect = open.el.getBoundingClientRect();
    const place = placeFloating(
      rect,
      { width: SIZE.width, height },
      { width: window.innerWidth, height: window.innerHeight },
      { prefer: "bottom" }
    );
    popup = createPortal(
      <div
        data-var-popup
        style={{ left: place.left, top: place.top, width: SIZE.width, maxHeight: height }}
        className="fixed z-[70] flex flex-col overflow-hidden rounded-large border border-default-200 bg-content1 shadow-large"
      >
        <p className="border-b border-divider px-3 py-1.5 text-tiny text-default-500">
          Variables · ↑↓ to move, Enter to insert
        </p>
        <ul
          id="api-variable-list"
          role="listbox"
          aria-label="Variables"
          className="flex flex-col overflow-y-auto p-1"
        >
          {shown.map((v, i) => (
            <VariableRow
              key={`${v.from}-${v.name}`}
              id={`api-variable-${i}`}
              variable={v}
              active={i === active}
              onPick={() => pick(v)}
            />
          ))}
        </ul>
      </div>,
      document.body
    );
  }

  return (
    <div ref={box} className={className}>
      {children}
      {popup}
    </div>
  );
}
