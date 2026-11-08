"use client";

import { formatJsonBody, jsonBodyProblem } from "@nextomic/schema";
import { Fragment, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Icon } from "@/lib/icons/Icon";

// The Body tab's JSON editor: a transparent textarea over a colored copy (typing, selection and
// undo stay native), line numbers, `<variable>` and `{{tag}}` highlighting, a Format button that
// keeps placeholders, and the first problem with its line under the box.

const TOKEN =
  /("(?:\\.|[^"\\\n])*"?)|(<[A-Za-z_]\w*>)|(\{\{[^}\n]*\}\})|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)/g;
const PLACEHOLDER = /(<[A-Za-z_]\w*>|\{\{[^}\n]*\}\})/;
const IS_PLACEHOLDER = /^(<[A-Za-z_]\w*>|\{\{[^}\n]*\}\})$/;

const COLORS = {
  key: "text-[#0451a5] dark:text-[#9cdcfe]",
  string: "text-[#a31515] dark:text-[#ce9178]",
  number: "text-[#098658] dark:text-[#b5cea8]",
  literal: "text-[#0000ff] dark:text-[#569cd6]",
  placeholder: "text-primary-600 dark:text-primary-400 font-semibold"
};

/** Colors a string literal, keeping placeholders inside it highlighted. */
function stringParts(text: string, className: string, key: string): ReactNode[] {
  return text.split(PLACEHOLDER).map((part, i) =>
    part === "" ? null : (
      <span
        key={`${key}-${i}`}
        className={IS_PLACEHOLDER.test(part) ? COLORS.placeholder : className}
      >
        {part}
      </span>
    )
  );
}

function highlight(source: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) out.push(source.slice(last, at));
    const [text, str, angle, tag, num] = match;
    const key = String(at);
    if (str) {
      const isKey = /^\s*:/.test(source.slice(at + text.length));
      out.push(...stringParts(str, isKey ? COLORS.key : COLORS.string, key));
    } else if (angle || tag)
      out.push(
        <span key={key} className={COLORS.placeholder}>
          {text}
        </span>
      );
    else
      out.push(
        <span key={key} className={num ? COLORS.number : COLORS.literal}>
          {text}
        </span>
      );
    last = at + text.length;
  }
  out.push(source.slice(last));
  return out;
}

const LINE = 20;
const BOX = "px-3 py-2.5 font-mono text-tiny leading-5 whitespace-pre";

export function JsonBodyEditor({
  value,
  onChange,
  label,
  textareaRef
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  /** Lets the variable chips insert at the caret. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const colored = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [formatError, setFormatError] = useState(false);
  const problem = useMemo(() => jsonBodyProblem(value), [value]);
  const lines = value.split("\n").length;
  const height = Math.min(24, Math.max(8, lines + 1)) * LINE + 20;

  const format = () => {
    const formatted = formatJsonBody(value);
    setFormatError(formatted === null);
    if (formatted !== null && formatted !== value) onChange(formatted);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        style={{ height }}
        className={`relative flex overflow-hidden rounded-medium bg-default-100 focus-within:ring-1 focus-within:ring-default-800/30 ${problem ? "ring-1 ring-danger/60" : ""}`}
      >
        <div
          ref={gutter}
          aria-hidden
          className="w-10 shrink-0 select-none overflow-hidden bg-default-200/60 py-2.5 text-right font-mono text-tiny leading-5 text-default-500"
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={`pr-2 ${problem?.line === i + 1 ? "text-danger" : ""}`}>
              {i + 1}
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <pre
            ref={colored}
            aria-hidden
            className={`pointer-events-none absolute inset-0 m-0 overflow-hidden text-foreground ${BOX}`}
          >
            {highlight(value).map((node, i) => (
              <Fragment key={i}>{node}</Fragment>
            ))}
            {"\n"}
          </pre>
          <textarea
            ref={textareaRef}
            aria-label={label}
            aria-invalid={problem !== null}
            aria-describedby="json-body-help"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            value={value}
            placeholder={'{\n  "name": "<name>"\n}'}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              const { scrollTop, scrollLeft } = e.currentTarget;
              if (colored.current) {
                colored.current.scrollTop = scrollTop;
                colored.current.scrollLeft = scrollLeft;
              }
              if (gutter.current) gutter.current.scrollTop = scrollTop;
            }}
            className={`absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-foreground outline-none placeholder:text-default-400 ${BOX}`}
          />
        </div>
        <button
          type="button"
          onClick={format}
          aria-label="Format JSON"
          data-tip="Format JSON"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-medium border border-default-300 bg-background text-default-600 hover:text-foreground"
        >
          <Icon name="ph:text-align-left" width={16} height={16} />
        </button>
      </div>
      <p
        id="json-body-help"
        className={`text-tiny ${problem || formatError ? "text-danger" : "text-default-500"}`}
      >
        {problem
          ? `Line ${problem.line}: ${problem.message}`
          : formatError
            ? "The JSON could not be formatted. Fix the problem first."
            : 'Use <name> for a variable: inside quotes for text ("<name>"), without quotes for numbers, true/false, lists and JSON (<count>).'}
      </p>
    </div>
  );
}
