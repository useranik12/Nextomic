"use client";

import {
  CLASS_NAME_PATTERN,
  HTML_ID_PATTERN,
  collectHtmlIds,
  type ElementNode
} from "@nextomic/schema";
import { useId, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { SettingRow, compactFieldClass } from "./setting-row";

type Kind = "class" | "id";
interface Active {
  kind: Kind;
  value: string;
}

const CLASS_CHIP = "bg-sky-500/15 text-sky-700 dark:text-sky-300";
const ID_CHIP = "bg-violet-500/15 text-violet-700 dark:text-violet-300";

/** "#hero" is an ID; anything else is a class (a leading dot is allowed). */
function parseEntry(text: string): { kind: Kind; value: string } | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("#")) return { kind: "id", value: trimmed.slice(1) };
  return { kind: "class", value: trimmed.replace(/^\./, "") };
}

/**
 * One input for classes and the ID. Type a class name, or #name for the ID, and press Enter or
 * Apply: it moves to the chips below. Click a chip to edit it in the input; X leaves that edit.
 */
export function IdentityField({ node }: { node: ElementNode }) {
  const inputId = useId();
  const setHtmlId = useEditorStore((s) => s.setElementHtmlId);
  const setClass = useEditorStore((s) => s.setElementClass);
  const removeClass = useEditorStore((s) => s.removeElementClass);
  const [text, setText] = useState("");
  const [active, setActive] = useState<Active | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setText("");
    setActive(null);
    setError(null);
  }

  function apply() {
    const entry = parseEntry(text);
    if (!entry) return;
    if (entry.kind === "id") {
      if (!HTML_ID_PATTERN.test(entry.value) || entry.value.length > 64) {
        setError("An ID starts with a letter, then letters, digits, - _ : .");
        return;
      }
      const doc = useEditorStore.getState().doc;
      const taken = doc ? collectHtmlIds(doc.tree) : new Set<string>();
      if (entry.value !== node.htmlId && taken.has(entry.value)) {
        setError("That ID is already used on this page.");
        return;
      }
      if (active?.kind === "class") removeClass(node.id, active.value);
      setHtmlId(node.id, entry.value);
    } else {
      if (!CLASS_NAME_PATTERN.test(entry.value) || entry.value.length > 64) {
        setError("A class uses letters, digits, - and _, and does not start with a digit.");
        return;
      }
      if (active?.kind === "id" && active.value === node.htmlId) setHtmlId(node.id, "");
      setClass(node.id, entry.value, active?.kind === "class" ? active.value : undefined);
    }
    reset();
  }

  function activate(next: Active) {
    setActive(next);
    setText(next.kind === "id" ? `#${next.value}` : next.value);
    setError(null);
  }

  const hasText = text.trim() !== "";

  return (
    <div className="flex flex-col gap-2">
      <SettingRow label="Classes and ID" htmlFor={inputId}>
        <div className="relative">
          <input
            id={inputId}
            value={text}
            placeholder="class or #id"
            aria-invalid={error !== null}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              } else if (e.key === "Escape" && (active || text)) {
                e.stopPropagation();
                reset();
              }
            }}
            className={compactFieldClass + " pr-24" + (error ? " !border-danger" : "")}
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {active ? (
              <button
                type="button"
                aria-label="Clear the active class or ID"
                onClick={reset}
                className="flex h-6 w-6 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-200 hover:text-foreground"
              >
                <Icon name="ph:x" width={12} height={12} />
              </button>
            ) : null}
            {hasText ? (
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
      ) : null}
      {node.htmlId || node.classIds.length > 0 ? (
        <ul aria-label="Applied classes and ID" className="flex flex-wrap gap-1.5">
          {node.htmlId ? (
            <Chip
              kind="id"
              value={node.htmlId}
              active={active?.kind === "id"}
              onActivate={() => activate({ kind: "id", value: node.htmlId as string })}
              onRemove={() => {
                setHtmlId(node.id, "");
                if (active?.kind === "id") reset();
              }}
            />
          ) : null}
          {node.classIds.map((name) => (
            <Chip
              key={name}
              kind="class"
              value={name}
              active={active?.kind === "class" && active.value === name}
              onActivate={() => activate({ kind: "class", value: name })}
              onRemove={() => {
                removeClass(node.id, name);
                if (active?.kind === "class" && active.value === name) reset();
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Chip({
  kind,
  value,
  active,
  onActivate,
  onRemove
}: {
  kind: Kind;
  value: string;
  active: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  const label = kind === "id" ? `#${value}` : value;
  return (
    <li
      className={
        "flex h-6 items-center rounded-full text-tiny " +
        (kind === "id" ? ID_CHIP : CLASS_CHIP) +
        (active ? " ring-2 ring-default-800" : "")
      }
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${kind === "id" ? "ID" : "Class"} ${label}`}
        onClick={onActivate}
        className="max-w-[170px] truncate pl-2.5 pr-1 font-medium"
      >
        {label}
      </button>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="mr-1 flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition-opacity duration-300 hover:opacity-100"
      >
        <Icon name="ph:x" width={10} height={10} />
      </button>
    </li>
  );
}
