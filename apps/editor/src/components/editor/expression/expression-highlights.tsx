"use client";

import { expressionProblem, expressionScope, runExpression, toText } from "@nextomic/schema";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { placeFloating } from "@/lib/place-floating";
import { useEditorDynamicContext } from "../use-editor-context";
import { asExpressionField, type TextField } from "./expression-field";
import { createMirror, fillMirror, removeMirror, syncGeometry, tagAt, type Mirror } from "./mirror";

const HOVER_MS = 500;
/** The `attr @ ID:name` form reads another element; it is not an expression to check. */
const ELEMENT_TAG = /^attr\s*@/;

interface Hover {
  rect: DOMRect;
  expr: string;
  text: string;
  error: boolean;
}

/**
 * Highlights {{tags}} in every field that has the dynamic bolt: tags are white and heavier, tags
 * with a problem are red, the rest of the text is softer. Resting the pointer on a tag for 500 ms
 * shows what it gives with the current preview values.
 */
export function ExpressionHighlights() {
  const context = useEditorDynamicContext();
  const scope = useMemo(() => (context ? expressionScope(context) : null), [context]);
  const scopeRef = useRef(scope);
  const version = useRef(0);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    scopeRef.current = scope;
    version.current++;
  }, [scope]);

  useEffect(() => {
    const fields = new Set<TextField>();
    const mirrors = new Map<TextField, Mirror>();
    let frame = 0;
    let scan = 0;

    const problem = (expr: string) => {
      const current = scopeRef.current;
      return (
        current !== null && !ELEMENT_TAG.test(expr) && expressionProblem(expr, current) !== null
      );
    };

    const rescan = () => {
      window.clearTimeout(scan);
      scan = window.setTimeout(() => {
        for (const el of document.querySelectorAll("input, textarea")) {
          const field = asExpressionField(el);
          if (field) fields.add(field);
        }
      }, 150);
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      for (const field of fields) {
        const mirror = mirrors.get(field);
        const visible = field.isConnected && field.offsetParent !== null;
        if (!visible || !field.value.includes("{{")) {
          if (mirror) {
            removeMirror(field, mirror);
            mirrors.delete(field);
          }
          if (!field.isConnected) fields.delete(field);
          continue;
        }
        const live = mirror ?? createMirror(field);
        if (!mirror) mirrors.set(field, live);
        const key = `${version.current}\u0000${field.value}`;
        if (live.key !== key) {
          live.key = key;
          fillMirror(live, field.value, problem);
        }
        syncGeometry(field, live);
      }
    };

    let timer = 0;
    let shown: HTMLSpanElement | null = null;
    const onMove = (e: PointerEvent) => {
      const field = e.target instanceof Element ? asExpressionField(e.target) : null;
      const mirror = field ? mirrors.get(field) : undefined;
      const span = mirror ? tagAt(mirror, e.clientX, e.clientY) : null;
      if (span === shown) return;
      shown = span;
      window.clearTimeout(timer);
      setHover(null);
      if (!span) return;
      timer = window.setTimeout(() => {
        const expr = span.dataset.expr ?? "";
        const current = scopeRef.current;
        if (!current || !span.isConnected) return;
        const issue = ELEMENT_TAG.test(expr) ? null : expressionProblem(expr, current);
        let text = issue ?? "";
        if (!issue && !ELEMENT_TAG.test(expr)) text = toText(runExpression(expr, current));
        if (ELEMENT_TAG.test(expr)) text = "Reads another element's attribute on the page.";
        setHover({ rect: span.getBoundingClientRect(), expr, text, error: issue !== null });
      }, HOVER_MS);
    };
    const onLeave = () => {
      shown = null;
      window.clearTimeout(timer);
      setHover(null);
    };

    const observer = new MutationObserver(rescan);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerdown", onLeave, true);
    document.addEventListener("keydown", onLeave, true);
    rescan();
    frame = requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerdown", onLeave, true);
      document.removeEventListener("keydown", onLeave, true);
      cancelAnimationFrame(frame);
      window.clearTimeout(scan);
      window.clearTimeout(timer);
      for (const [field, mirror] of mirrors) removeMirror(field, mirror);
    };
  }, []);

  return hover ? <TagValue hover={hover} /> : null;
}

function TagValue({ hover }: { hover: Hover }) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setPlace(
      placeFloating(
        hover.rect,
        { width: el.offsetWidth, height: el.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
  }, [hover]);
  return (
    <div
      ref={box}
      role="tooltip"
      style={{ left: place?.left ?? -9999, top: place?.top ?? -9999 }}
      className="pointer-events-none fixed z-[1950] max-w-sm rounded-large border border-default-200 bg-content1 px-3 py-2 shadow-xl"
    >
      <p className="truncate font-mono text-[10px] text-default-400">{`{{ ${hover.expr} }}`}</p>
      <p
        className={`mt-1 whitespace-pre-wrap break-words font-mono text-tiny ${hover.error ? "text-danger" : "text-foreground"}`}
      >
        {hover.text || <span className="text-default-400">(empty)</span>}
      </p>
    </div>
  );
}
