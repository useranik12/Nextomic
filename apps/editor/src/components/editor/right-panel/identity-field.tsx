"use client";

import {
  CLASS_NAME_PATTERN,
  HTML_ID_PATTERN,
  collectHtmlIds,
  type ElementNode
} from "@nextomic/schema";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { SettingRow, compactFieldClass } from "./setting-row";

const CLASS_CHIP = "bg-sky-500/15 text-sky-700 dark:text-sky-300";
const ID_FIELD = "!border-violet-500/40 bg-violet-500/10 font-mono";
const CLASS_FIELD = "!border-sky-500/50 bg-sky-500/15 font-mono";

/**
 * One input for the element's ID and classes, like Bricks. With no class active the input holds the
 * ID (`#name`) and Design edits go to the element. Type a plain name and press Enter or Apply to
 * add a class; double-click a class chip to edit that class (the input holds its name and Design
 * edits go to the class); X returns to the ID.
 */
export function IdentityField({ node }: { node: ElementNode }) {
  const inputId = useId();
  const setHtmlId = useEditorStore((s) => s.setElementHtmlId);
  const setClass = useEditorStore((s) => s.setElementClass);
  const removeClass = useEditorStore((s) => s.removeElementClass);
  const activeClass = useEditorStore((s) => s.activeClass);
  const setActiveClass = useEditorStore((s) => s.setActiveClass);
  const base = activeClass ?? (node.htmlId ? `#${node.htmlId}` : "");
  const [text, setText] = useState(base);
  const [error, setError] = useState<string | null>(null);

  // The input follows the active target (ID or class) and the stored ID.
  useEffect(() => {
    setText(base);
    setError(null);
  }, [base]);

  function applyId(raw: string) {
    const value = raw.slice(1);
    if (value === "") {
      setHtmlId(node.id, "");
      return;
    }
    if (!HTML_ID_PATTERN.test(value) || value.length > 64) {
      setError("An ID starts with a letter, then letters, digits, - _ : .");
      return;
    }
    const doc = useEditorStore.getState().doc;
    const taken = doc ? collectHtmlIds(doc.tree) : new Set<string>();
    if (value !== node.htmlId && taken.has(value)) {
      setError("That ID is already used on this page.");
      return;
    }
    setHtmlId(node.id, value);
    setError(null);
  }

  function applyClass(raw: string, replacing?: string) {
    const name = raw.replace(/^\./, "");
    if (!CLASS_NAME_PATTERN.test(name) || name.length > 64) {
      setError("A class uses letters, digits, - and _, does not start with a digit, and has no #.");
      return;
    }
    setClass(node.id, name, replacing);
    setError(null);
    if (replacing === undefined) setText(base);
  }

  function apply() {
    const value = text.trim();
    if (activeClass) {
      if (value === "") return removeClassAndLeave(activeClass);
      applyClass(value, activeClass);
    } else if (value.startsWith("#")) applyId(value);
    else if (value === "") applyId("#");
    else applyClass(value);
  }

  function removeClassAndLeave(name: string) {
    removeClass(node.id, name);
  }

  const changed = text.trim() !== base;

  return (
    <div className="flex flex-col gap-2">
      <SettingRow label={activeClass ? "Class" : "ID and classes"} htmlFor={inputId}>
        <div className="relative">
          <input
            id={inputId}
            value={text}
            placeholder="#id or class"
            aria-invalid={error !== null}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              } else if (e.key === "Escape" && changed) {
                e.stopPropagation();
                setText(base);
                setError(null);
              }
            }}
            className={
              compactFieldClass +
              " pr-24 " +
              (activeClass ? CLASS_FIELD : ID_FIELD) +
              (error ? " !border-danger" : "")
            }
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {activeClass ? (
              <button
                type="button"
                aria-label="Stop editing the class and return to the ID"
                onClick={() => setActiveClass(null)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-default-600 transition-colors duration-300 hover:bg-default-200 hover:text-foreground"
              >
                <Icon name="ph:x" width={12} height={12} />
              </button>
            ) : null}
            {changed ? (
              <button
                type="button"
                onClick={apply}
                className="h-6 rounded-full bg-default-800 px-2.5 text-tiny font-medium text-default-50 transition-colors duration-300 hover:bg-default-700"
              >
                Apply
              </button>
            ) : null}
          </div>
        </div>
      </SettingRow>
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      ) : (
        <p className="text-tiny text-default-500">
          {activeClass
            ? `Design edits change .${activeClass} for every element that uses it.`
            : "Design edits change this element only."}
        </p>
      )}
      {node.classIds.length > 0 ? (
        <ul aria-label="Applied classes" className="flex flex-wrap gap-1.5">
          {node.classIds.map((name) => (
            <Chip
              key={name}
              value={name}
              active={activeClass === name}
              onActivate={() => setActiveClass(name)}
              onRemove={() => removeClass(node.id, name)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Chip({
  value,
  active,
  onActivate,
  onRemove
}: {
  value: string;
  active: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={
        "flex h-6 items-center rounded-full text-tiny " +
        CLASS_CHIP +
        (active ? " ring-2 ring-sky-500" : "")
      }
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`Class ${value}. Double-click to edit it`}
        title="Double-click to edit this class"
        onDoubleClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter") onActivate();
        }}
        className="max-w-[170px] truncate pl-2.5 pr-1 font-mono font-medium"
      >
        {value}
      </button>
      <button
        type="button"
        aria-label={`Remove ${value}`}
        onClick={onRemove}
        className="mr-1 flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition-opacity duration-300 hover:opacity-100"
      >
        <Icon name="ph:x" width={10} height={10} />
      </button>
    </li>
  );
}
