"use client";

import {
  completeExpression,
  expressionAtCaret,
  expressionScope,
  runExpression,
  splitTemplate,
  toText,
  type Completion
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { placeBeside } from "@/lib/place-floating";
import { useTypeRegistry } from "../data-types/type-picker";
import { useEditorDynamicContext } from "../use-editor-context";
import { asExpressionField, replaceInField, type TextField } from "./expression-field";
import { ExpressionPanel, type PanelResult } from "./expression-panel";

interface Open {
  el: TextField;
  /** Where the word being completed starts, and the caret, in the field's value. */
  from: number;
  caret: number;
  /** Every suggestion at the caret; the search narrows what is shown. */
  all: Completion[];
  search: string;
  active: number;
  result: PanelResult | null;
}

const PANEL = { width: 544, height: 360 };
/** Keys the panel handles itself; they must not refresh it, or the active item would reset. */
const PANEL_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"]);

/** The value of the closed {{ }} around the caret, or null while it is still open. */
function resultAt(
  value: string,
  caret: number,
  scope: Record<string, unknown>
): PanelResult | null {
  const part = splitTemplate(value).find(
    (p) => typeof p !== "string" && p.start < caret && caret <= p.end
  );
  if (!part || typeof part === "string" || part.expr === "") return null;
  try {
    return { text: toText(runExpression(part.expr, scope)), error: false };
  } catch (error) {
    return { text: error instanceof Error ? error.message : "Invalid expression.", error: true };
  }
}

/** How many "{" are open in an expression (outside strings), so a "}" may close an object. */
function openBraces(source: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth = Math.max(depth - 1, 0);
  }
  return depth;
}

function shownOf(state: Open): Completion[] {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.all;
  return state.all.filter((i) => `${i.label} ${i.description}`.toLowerCase().includes(q));
}

/**
 * n8n-style help while writing {{ expressions }} in any field that has the dynamic bolt. Whenever
 * the caret is inside {{ }} it shows the names, fields and methods that fit (grouped, with what
 * they do and an example) and the result with the current preview data. Typing {{ adds the }}.
 */
export function ExpressionAssist() {
  const context = useEditorDynamicContext();
  const registry = useTypeRegistry();
  const scope = useMemo(() => (context ? expressionScope(context) : null), [context]);
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;
  // Escape closes the panel until the field's text or caret changes.
  const dismissed = useRef<{ el: TextField; value: string; caret: number } | null>(null);

  const refresh = useCallback(
    (el: TextField) => {
      if (!scope || !context) return setOpen(null);
      const caret = el.selectionStart ?? el.value.length;
      const gone = dismissed.current;
      if (gone && gone.el === el && gone.value === el.value && gone.caret === caret) return;
      dismissed.current = null;
      const at = expressionAtCaret(el.value, caret);
      if (!at || at.start > caret) return setOpen(null);
      const found = completeExpression(at.source, scope, { hints: context.types, registry });
      const result = resultAt(el.value, caret, scope);
      // Inside a quoted string there is nothing to suggest.
      if (found.items.length === 0 && !result) return setOpen(null);
      const previous = openRef.current;
      setOpen({
        el,
        from: at.start + found.from,
        caret,
        all: found.items.slice(0, 300),
        search: previous?.el === el ? previous.search : "",
        active: 0,
        result
      });
    },
    [scope, context, registry]
  );

  const pick = useCallback((index: number) => {
    const state = openRef.current;
    const item = state ? shownOf(state)[index] : undefined;
    if (!state || !item) return;
    const { el, from, caret } = state;
    setOpen(null);
    replaceInField(el, from, caret, item.insert, from + item.caret);
  }, []);

  const move = useCallback((step: number) => {
    const state = openRef.current;
    const count = state ? shownOf(state).length : 0;
    if (!state || count === 0) return;
    setOpen({ ...state, active: (state.active + step + count) % count });
  }, []);

  const close = useCallback(() => {
    const state = openRef.current;
    if (state)
      dismissed.current = {
        el: state.el,
        value: state.el.value,
        caret: state.el.selectionStart ?? 0
      };
    setOpen(null);
  }, []);

  useEffect(() => {
    // Deleting a brace of an opening "{{" also removes the "}}" that closed it.
    let pendingClose: { el: TextField; at: number } | null = null;
    const onBeforeInput = (e: InputEvent) => {
      pendingClose = null;
      const el = asExpressionField(e.target);
      const backward = e.inputType === "deleteContentBackward";
      if (!el || (!backward && e.inputType !== "deleteContentForward")) return;
      if (el.selectionStart !== el.selectionEnd) return;
      const caret = el.selectionStart ?? 0;
      const deleted = backward ? caret - 1 : caret;
      if (el.value[deleted] !== "{") return;
      const open =
        el.value[deleted - 1] === "{" ? deleted - 1 : el.value[deleted + 1] === "{" ? deleted : -1;
      if (open === -1) return;
      const part = splitTemplate(el.value).find((p) => typeof p !== "string" && p.start === open);
      // After the brace is gone the "}}" sits one character earlier.
      if (part && typeof part !== "string") pendingClose = { el, at: part.end - 3 };
    };
    const onInput = (e: Event) => {
      const el = asExpressionField(e.target);
      if (!el) return;
      const caret = el.selectionStart ?? 0;
      const brace = pendingClose;
      pendingClose = null;
      if (brace && brace.el === el && el.value.slice(brace.at, brace.at + 2) === "}}") {
        const from = el.value[brace.at - 1] === " " ? brace.at - 1 : brace.at;
        replaceInField(el, from, brace.at + 2, "", caret);
      }
      // Typing the second "{" closes the expression and puts the caret between the braces.
      if (
        e instanceof InputEvent &&
        e.inputType === "insertText" &&
        e.data === "{" &&
        el.value.slice(caret - 2, caret) === "{{" &&
        el.value.slice(caret - 3, caret - 2) !== "{" &&
        !el.value.slice(caret).trimStart().startsWith("}}")
      ) {
        replaceInField(el, caret, caret, "  }}", caret + 1);
      }
      refresh(el);
    };
    const onCaret = (e: Event) => {
      if (e instanceof KeyboardEvent && PANEL_KEYS.has(e.key)) return;
      const el = asExpressionField(e.target);
      if (el) refresh(el);
    };
    const onKey = (e: KeyboardEvent) => {
      // Typing "}" steps over the "}}" that closes the expression instead of adding another.
      const field = e.key === "}" ? asExpressionField(e.target) : null;
      if (field && field.selectionStart === field.selectionEnd) {
        const caret = field.selectionStart ?? 0;
        const at = expressionAtCaret(field.value, caret);
        const closing = /^\s*\}\}/.exec(field.value.slice(caret));
        if (at && closing && openBraces(at.source) === 0) {
          e.preventDefault();
          const next = caret + closing[0].indexOf("}") + 1;
          field.setSelectionRange(next, next);
          refresh(field);
          return;
        }
      }
      const state = openRef.current;
      if (!state || e.target !== state.el) return;
      const count = shownOf(state).length;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown" && count) move(1);
      else if (e.key === "ArrowUp" && count) move(-1);
      else if ((e.key === "Enter" || e.key === "Tab") && count) pick(state.active);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onBlur = (e: FocusEvent) => {
      const state = openRef.current;
      if (!state) return;
      const inPanel = (n: EventTarget | null) =>
        n instanceof Element && n.closest("[data-expression-panel]") !== null;
      if (state.el !== e.target && !inPanel(e.target)) return;
      // Moving between the field and the panel's search keeps it open.
      if (inPanel(e.relatedTarget) || e.relatedTarget === state.el) return;
      setOpen(null);
    };
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keyup", onCaret, true);
    document.addEventListener("click", onCaret, true);
    document.addEventListener("focusin", onCaret, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusout", onBlur, true);
    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keyup", onCaret, true);
      document.removeEventListener("click", onCaret, true);
      document.removeEventListener("focusin", onCaret, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusout", onBlur, true);
    };
  }, [refresh, pick, move, close]);

  if (!open) return null;
  const items = shownOf(open);
  const rect = open.el.getBoundingClientRect();
  // Beside the field (left or right, whichever has more room), never over its text.
  const place = placeBeside(
    rect,
    { width: Math.min(PANEL.width, window.innerWidth - 16), height: PANEL.height },
    { width: window.innerWidth, height: window.innerHeight }
  );
  return (
    <ExpressionPanel
      items={items}
      active={Math.min(open.active, Math.max(items.length - 1, 0))}
      result={open.result}
      search={open.search}
      style={{ left: place.left, top: place.top }}
      onSearch={(search) => setOpen({ ...open, search, active: 0 })}
      onSearchKey={(e) => {
        if (e.key === "ArrowDown") move(1);
        else if (e.key === "ArrowUp") move(-1);
        else if (e.key === "Enter") pick(open.active);
        else if (e.key === "Escape") {
          open.el.focus();
          close();
        } else return;
        e.preventDefault();
      }}
      onHover={(active) => setOpen({ ...open, active })}
      onPick={pick}
    />
  );
}
