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
import { placeFloating } from "@/lib/place-floating";
import { useTypeRegistry } from "../data-types/type-picker";
import { useEditorDynamicContext } from "../use-editor-context";
import { asExpressionField, setFieldValue, type TextField } from "./expression-field";
import { ExpressionPanel } from "./expression-panel";

interface Open {
  el: TextField;
  /** Where the word being completed starts, and the caret, in the field's value. */
  from: number;
  caret: number;
  items: Completion[];
  active: number;
  result: { text: string; error: boolean } | null;
}

const PANEL = { width: 544, height: 300 };
const PANEL_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"]);

/** The value of the closed {{ }} around the caret, or null while it is still open. */
function resultAt(value: string, caret: number, scope: Record<string, unknown>) {
  const part = splitTemplate(value).find(
    (p) => typeof p !== "string" && p.start < caret && caret <= p.end
  );
  if (!part || typeof part === "string") return null;
  try {
    return { text: toText(runExpression(part.expr, scope)), error: false };
  } catch (error) {
    return { text: error instanceof Error ? error.message : "Invalid expression.", error: true };
  }
}

/**
 * n8n-style help while writing {{ expressions }} in any field that has the dynamic bolt: typing
 * shows the names, fields and methods that fit (with what they do and an example), and the
 * result of the expression with the current preview data.
 */
export function ExpressionAssist() {
  const context = useEditorDynamicContext();
  const registry = useTypeRegistry();
  const scope = useMemo(() => (context ? expressionScope(context) : null), [context]);
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;

  const refresh = useCallback(
    (el: TextField) => {
      if (!scope || !context) return setOpen(null);
      const caret = el.selectionStart ?? el.value.length;
      const at = expressionAtCaret(el.value, caret);
      const result = resultAt(el.value, caret, scope);
      if (!at)
        return setOpen(result ? { el, from: caret, caret, items: [], active: 0, result } : null);
      const found = completeExpression(at.source, scope, { hints: context.types, registry });
      if (found.items.length === 0 && !result) return setOpen(null);
      setOpen({
        el,
        from: at.start + found.from,
        caret,
        items: found.items.slice(0, 200),
        active: 0,
        result
      });
    },
    [scope, context, registry]
  );

  const pick = useCallback((index: number) => {
    const state = openRef.current;
    const item = state?.items[index];
    if (!state || !item) return;
    const { el, from, caret } = state;
    const value = el.value.slice(0, from) + item.insert + el.value.slice(caret);
    setFieldValue(el, value, from + item.caret);
    setOpen(null);
  }, []);

  useEffect(() => {
    const onInput = (e: Event) => {
      const el = asExpressionField(e.target);
      if (el) refresh(el);
    };
    const onCaret = (e: Event) => {
      // The keys the panel handles must not refresh it, or the active item would jump back to the top.
      if (e instanceof KeyboardEvent && PANEL_KEYS.has(e.key)) return;
      const el = asExpressionField(e.target);
      if (el && openRef.current?.el === el) refresh(el);
    };
    const onKey = (e: KeyboardEvent) => {
      const state = openRef.current;
      if (!state || e.target !== state.el) return;
      const count = state.items.length;
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowDown" && count)
        setOpen({ ...state, active: (state.active + 1) % count });
      else if (e.key === "ArrowUp" && count)
        setOpen({ ...state, active: (state.active - 1 + count) % count });
      else if ((e.key === "Enter" || e.key === "Tab") && count) pick(state.active);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onBlur = (e: FocusEvent) => {
      if (openRef.current?.el === e.target) setOpen(null);
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keyup", onCaret, true);
    document.addEventListener("click", onCaret, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusout", onBlur, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keyup", onCaret, true);
      document.removeEventListener("click", onCaret, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusout", onBlur, true);
    };
  }, [refresh, pick]);

  if (!open) return null;
  const rect = open.el.getBoundingClientRect();
  const place = placeFloating(
    rect,
    {
      width: Math.min(PANEL.width, window.innerWidth - 16),
      height: open.items.length ? PANEL.height : 40
    },
    { width: window.innerWidth, height: window.innerHeight },
    { prefer: "bottom" }
  );
  return (
    <ExpressionPanel
      items={open.items}
      active={open.active}
      result={open.result}
      style={{ left: place.left, top: place.top }}
      onHover={(active) => setOpen({ ...open, active })}
      onPick={pick}
    />
  );
}
