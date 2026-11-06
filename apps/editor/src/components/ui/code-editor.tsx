"use client";

import { useRef, type KeyboardEvent } from "react";
import { tokenizeCss, type CssTokenType } from "@/lib/css-highlight";

// Colors follow VS Code Dark+ on dark backgrounds and VS Code Light+ on light ones.
const TOKEN_COLOR: Record<CssTokenType, string> = {
  comment: "text-[#008000] dark:text-[#6a9955] italic",
  at: "text-[#af00db] dark:text-[#c586c0]",
  class: "text-[#800000] dark:text-[#d7ba7d]",
  id: "text-[#800000] dark:text-[#d7ba7d]",
  pseudo: "text-[#800000] dark:text-[#d7ba7d]",
  tag: "text-[#800000] dark:text-[#d7ba7d]",
  attr: "text-[#e50000] dark:text-[#9cdcfe]",
  property: "text-[#e50000] dark:text-[#9cdcfe]",
  number: "text-[#098658] dark:text-[#b5cea8]",
  color: "text-[#098658] dark:text-[#b5cea8]",
  string: "text-[#a31515] dark:text-[#ce9178]",
  function: "text-[#795e26] dark:text-[#dcdcaa]",
  variable: "text-[#001080] dark:text-[#9cdcfe]",
  keyword: "text-[#0451a5] dark:text-[#ce9178]",
  important: "text-[#0000ff] dark:text-[#569cd6]",
  punct: "text-[#3b3b3b] dark:text-[#d4d4d4]",
  text: "text-foreground"
};

const INDENT = "  ";

const LINE_HEIGHT = 20;
const MAX_LINES = 16;
const BOX = "px-3 py-2.5 font-mono text-tiny leading-5 whitespace-pre";

/**
 * Tab indents like a code editor (Shift+Tab outdents, also over several lines) instead of moving
 * focus. Keyboard users leave the field with Escape, then Tab.
 */
function indentOnTab(
  e: KeyboardEvent<HTMLTextAreaElement>,
  onChange: (next: string) => void
): void {
  const area = e.currentTarget;
  if (e.key === "Escape") {
    area.dataset.freeTab = "1";
    return;
  }
  if (e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey) {
    if (e.key.length === 1) delete area.dataset.freeTab;
    return;
  }
  if (area.dataset.freeTab === "1") {
    delete area.dataset.freeTab;
    return;
  }
  e.preventDefault();
  const { value, selectionStart: start, selectionEnd: end } = area;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const multi = value.slice(start, end).includes("\n");
  let next: string;
  let from = start;
  let to = end;
  if (!e.shiftKey && !multi) {
    next = value.slice(0, start) + INDENT + value.slice(end);
    from = to = start + INDENT.length;
  } else {
    const block = value.slice(lineStart, end);
    const lines = block.split("\n");
    const changed = lines.map((line) =>
      e.shiftKey ? line.replace(/^ {1,2}|^\t/, "") : INDENT + line
    );
    const out = changed.join("\n");
    next = value.slice(0, lineStart) + out + value.slice(end);
    const firstDelta = changed[0] ? changed[0].length - (lines[0]?.length ?? 0) : 0;
    from = Math.max(lineStart, start + firstDelta);
    to = end + (out.length - block.length);
  }
  onChange(next);
  requestAnimationFrame(() => area.setSelectionRange(from, to));
}

/**
 * A CSS editor with syntax colors: a transparent textarea sits over a colored copy of the same text
 * so typing, selection and undo stay native. The copy scrolls with the textarea.
 */
export function CssCodeEditor({
  value,
  onChange,
  label,
  placeholder,
  invalid,
  onFocus,
  onBlur
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  invalid?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const colored = useRef<HTMLPreElement>(null);
  const lines = Math.min(MAX_LINES, Math.max(5, value.split("\n").length + 1));

  return (
    <div
      style={{ height: lines * LINE_HEIGHT + 20 }}
      className={
        "relative overflow-hidden rounded-medium bg-default-100 focus-within:ring-1 focus-within:ring-default-800/30 " +
        (invalid ? "ring-1 ring-danger" : "")
      }
    >
      <pre
        ref={colored}
        aria-hidden
        className={`pointer-events-none absolute inset-0 m-0 overflow-hidden ${BOX}`}
      >
        {tokenizeCss(value).map((token, i) => (
          <span key={i} className={TOKEN_COLOR[token.type]}>
            {token.text}
          </span>
        ))}
        {"\n"}
      </pre>
      <textarea
        aria-label={label}
        aria-invalid={invalid}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => indentOnTab(e, onChange)}
        onScroll={(e) => {
          if (!colored.current) return;
          colored.current.scrollTop = e.currentTarget.scrollTop;
          colored.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
        className={`absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-foreground outline-none placeholder:text-default-400 ${BOX}`}
      />
    </div>
  );
}
