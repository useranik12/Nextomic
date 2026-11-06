"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

const MIN_LINES = 3;
const MAX_LINES = 20;

/** A textarea that grows with its text up to 20 lines, then scrolls. */
export function AutoTextarea(props: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = Number.parseFloat(style.lineHeight) || 20;
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const border =
      Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
    el.style.height = "auto";
    const wanted = Math.min(el.scrollHeight, line * MAX_LINES + padding + border);
    el.style.height = `${Math.max(wanted, line * MIN_LINES + padding + border)}px`;
    el.style.overflowY = el.scrollHeight > line * MAX_LINES + padding + border ? "auto" : "hidden";
  }, [props.value]);

  return <textarea ref={ref} rows={MIN_LINES} {...props} />;
}
