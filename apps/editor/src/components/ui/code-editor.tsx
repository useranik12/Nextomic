"use client";

import { useRef } from "react";
import { tokenizeCss, type CssTokenType } from "@/lib/css-highlight";

// Colors follow VS Code Dark+ on dark backgrounds and GitHub Light on light ones.
const TOKEN_COLOR: Record<CssTokenType, string> = {
  comment: "text-[#6a737d] dark:text-[#6a9955] italic",
  at: "text-[#d73a49] dark:text-[#c586c0]",
  class: "text-[#6f42c1] dark:text-[#d7ba7d]",
  id: "text-[#e36209] dark:text-[#d7ba7d]",
  pseudo: "text-[#22863a] dark:text-[#4ec9b0]",
  tag: "text-[#22863a] dark:text-[#569cd6]",
  attr: "text-[#005cc5] dark:text-[#9cdcfe]",
  property: "text-[#005cc5] dark:text-[#9cdcfe]",
  number: "text-[#005cc5] dark:text-[#b5cea8]",
  color: "text-[#032f62] dark:text-[#ce9178]",
  string: "text-[#032f62] dark:text-[#ce9178]",
  function: "text-[#6f42c1] dark:text-[#dcdcaa]",
  important: "text-[#d73a49] dark:text-[#569cd6]",
  punct: "text-default-500",
  text: "text-foreground"
};

const LINE_HEIGHT = 20;
const MAX_LINES = 16;
const BOX = "px-3 py-2.5 font-mono text-tiny leading-5 whitespace-pre";

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
        "relative overflow-hidden rounded-medium bg-default-100 focus-within:ring-2 focus-within:ring-default-800/30 " +
        (invalid ? "ring-2 ring-danger" : "")
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
