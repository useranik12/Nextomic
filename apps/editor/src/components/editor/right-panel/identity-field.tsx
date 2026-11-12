"use client";

import {
  CLASS_NAME_PATTERN,
  HTML_ID_PATTERN,
  collectHtmlIds,
  type ElementNode,
  type PseudoState
} from "@nextomic/schema";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { SettingRow, compactFieldClass } from "./setting-row";

const CLASS_CHIP = "bg-sky-500/15 text-sky-700 dark:text-sky-300";
const ID_CHIP = "bg-amber-500/15 text-amber-700 dark:text-amber-300";
const STATE_CHIP = "bg-violet-500/15 text-violet-700 dark:text-violet-300";
const STATE_ACTIVE = "bg-pink-500/20 text-pink-700 ring-1 ring-pink-500 dark:text-pink-300";
const FADED = "opacity-40 hover:opacity-80";
const STATES: PseudoState[] = ["default", "hover", "focus", "active", "disabled"];
const ID_FIELD = "!border-amber-500/50 bg-amber-500/10 font-mono";
const CLASS_FIELD = "!border-sky-500/50 bg-sky-500/15 font-mono";
const ICON_BUTTON =
  "flex h-6 w-6 items-center justify-center rounded-full text-body transition-colors duration-300 hover:bg-default-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-focus/30";

type FieldMode = "view" | "edit" | "add";

/**
 * The element's target field, like Bricks. It shows the active target (the ID, or the class that was
 * double-clicked) and cannot be typed in until the pencil is pressed; the plus adds a class. With no
 * class active, Design edits go to the element. Double-click a class chip to edit that class and
 * double-click it again (or press X) to go back. A single click on a chip does nothing. Everything
 * that is not the active target is faded.
 */
export function IdentityField({ node }: { node: ElementNode }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const setHtmlId = useEditorStore((s) => s.setElementHtmlId);
  const setClass = useEditorStore((s) => s.setElementClass);
  const removeClass = useEditorStore((s) => s.removeElementClass);
  const activeClass = useEditorStore((s) => s.activeClass);
  const setActiveClass = useEditorStore((s) => s.setActiveClass);
  // With automatic IDs on, every element keeps an ID: it can be renamed but not removed.
  const idRequired = useEditorStore((s) => s.project.generateElementIds);
  const activeState = useEditorStore((s) => s.activeState);
  const setActiveState = useEditorStore((s) => s.setActiveState);
  const breakpointId = useEditorStore((s) => s.activeBreakpointId);
  const targetStyles = useEditorStore((s) =>
    activeClass ? s.project.classes[activeClass] : node.styles
  );
  const base = activeClass ?? (node.htmlId ? `#${node.htmlId}` : "");
  const [mode, setMode] = useState<FieldMode>("view");
  const [text, setText] = useState(base);
  const [error, setError] = useState<string | null>(null);

  // The field leaves editing and follows the active target whenever the target changes.
  useEffect(() => {
    setMode("view");
    setText(base);
    setError(null);
  }, [base, node.id]);

  useEffect(() => {
    if (mode === "view") return;
    input.current?.focus();
    if (mode === "edit") input.current?.select();
  }, [mode]);

  function finish() {
    setMode("view");
    setText(base);
    setError(null);
  }

  function applyId(raw: string): boolean {
    const value = raw.slice(1);
    if (value === "") {
      if (idRequired) {
        setError("Automatic IDs are on, so an element always keeps an ID. Rename it instead.");
        return false;
      }
      setHtmlId(node.id, "");
      return true;
    }
    if (!HTML_ID_PATTERN.test(value) || value.length > 64) {
      setError("An ID starts with a letter, then letters, digits, - _ : .");
      return false;
    }
    const doc = useEditorStore.getState().doc;
    const taken = doc ? collectHtmlIds(doc.tree) : new Set<string>();
    if (value !== node.htmlId && taken.has(value)) {
      setError("That ID is already used on this page.");
      return false;
    }
    setHtmlId(node.id, value);
    return true;
  }

  function applyClass(raw: string, replacing?: string): boolean {
    const name = raw.replace(/^\./, "");
    if (!CLASS_NAME_PATTERN.test(name) || name.length > 64) {
      setError("A class uses letters, digits, - and _, does not start with a digit, and has no #.");
      return false;
    }
    setClass(node.id, name, replacing);
    return true;
  }

  function apply() {
    const value = text.trim();
    let ok: boolean;
    if (mode === "add") ok = value === "" ? true : applyClass(value);
    else if (activeClass) {
      if (value === "") {
        removeClass(node.id, activeClass);
        ok = true;
      } else ok = applyClass(value, activeClass);
    } else if (value.startsWith("#")) ok = applyId(value);
    else if (value === "") ok = applyId("#");
    else ok = applyClass(value);
    if (ok) finish();
  }

  const editing = mode !== "view";
  const changed = editing && text.trim() !== (mode === "add" ? "" : base);
  const placeholder = mode === "add" ? "New class name" : "#id or class";

  return (
    <div className="flex flex-col gap-2">
      <SettingRow label={activeClass ? "Class" : "ID and classes"} htmlFor={inputId}>
        <div className="group relative">
          <input
            ref={input}
            id={inputId}
            value={editing ? text : base}
            readOnly={!editing}
            tabIndex={editing ? 0 : -1}
            placeholder={editing ? placeholder : "No ID"}
            aria-invalid={error !== null}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onBlur={(e) => {
              // Pressing Apply moves focus first; anything else leaves editing without applying.
              if (editing && !(e.relatedTarget instanceof HTMLButtonElement)) finish();
            }}
            onKeyDown={(e) => {
              if (!editing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                finish();
              }
            }}
            className={
              compactFieldClass +
              " pr-20 " +
              (editing ? "" : "pointer-events-none select-none ") +
              (activeClass ? CLASS_FIELD : ID_FIELD) +
              (error ? " !border-danger" : "")
            }
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {editing ? (
              changed ? (
                <button
                  type="button"
                  onClick={apply}
                  className="h-6 rounded-full bg-default-hover px-2.5 text-xs font-medium text-foreground transition-colors duration-300 hover:bg-default-hover"
                >
                  Apply
                </button>
              ) : null
            ) : (
              <>
                {activeClass ? (
                  <button
                    type="button"
                    aria-label="Stop editing the class and return to the ID"
                    title="Back to the ID"
                    onClick={() => setActiveClass(null)}
                    className={ICON_BUTTON}
                  >
                    <Icon name="ph:x" width={12} height={12} />
                  </button>
                ) : null}
                {base ? (
                  <button
                    type="button"
                    aria-label={activeClass ? "Rename the class" : "Edit the ID"}
                    title={activeClass ? "Rename the class" : "Edit the ID"}
                    onClick={() => {
                      setText(base);
                      setMode("edit");
                    }}
                    className={ICON_BUTTON}
                  >
                    <Icon name="ph:pencil-simple" width={12} height={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Add a class"
                  title="Add a class"
                  onClick={() => {
                    setText("");
                    setMode("add");
                  }}
                  className={ICON_BUTTON}
                >
                  <Icon name="ph:plus" width={12} height={12} />
                </button>
              </>
            )}
          </div>
        </div>
      </SettingRow>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted">
          {activeClass
            ? `Design edits change .${activeClass} for every element that uses it.`
            : "Design edits change this element only."}
        </p>
      )}
      <ul aria-label="State being edited" className="flex flex-wrap gap-1.5">
        {STATES.map((state) => {
          const active = activeState === state;
          const set =
            Object.keys(targetStyles?.breakpoints[breakpointId]?.[state] ?? {}).length > 0;
          return (
            <li
              key={state}
              className={
                "flex h-6 items-center rounded-full text-xs transition-opacity duration-300 " +
                (active ? STATE_ACTIVE : STATE_CHIP + " " + FADED)
              }
            >
              <button
                type="button"
                aria-pressed={active}
                title={
                  active && state !== "default"
                    ? "Click to return to the default state"
                    : "Edit this state"
                }
                onClick={() => setActiveState(active && state !== "default" ? "default" : state)}
                className="flex items-center gap-1 px-2.5 font-mono font-medium capitalize"
              >
                {state === "default" ? "default" : `:${state}`}
                {set ? (
                  <span
                    role="img"
                    aria-label="Has styles in this state"
                    className="h-1.5 w-1.5 rounded-full bg-warning"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {node.htmlId || node.classIds.length > 0 ? (
        <ul aria-label="Applied ID and classes" className="flex flex-wrap gap-1.5">
          {node.htmlId ? (
            <Chip
              prefix="#"
              value={node.htmlId}
              tone={ID_CHIP}
              ring="ring-amber-500"
              active={!activeClass}
              hint={
                idRequired
                  ? "Active whenever no class is selected. Use the pencil above to rename it."
                  : "Active whenever no class is selected"
              }
              onRemove={idRequired ? undefined : () => setHtmlId(node.id, "")}
            />
          ) : null}
          {node.classIds.map((name) => (
            <Chip
              key={name}
              prefix="."
              value={name}
              tone={CLASS_CHIP}
              ring="ring-sky-500"
              active={activeClass === name}
              hint="Double-click to edit this class. Double-click again to release it."
              onActivate={() => setActiveClass(activeClass === name ? null : name)}
              onRemove={() => removeClass(node.id, name)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Chip({
  prefix,
  value,
  tone,
  ring,
  active,
  hint,
  onActivate,
  onRemove
}: {
  prefix: "#" | ".";
  value: string;
  tone: string;
  ring: string;
  active: boolean;
  hint: string;
  /** Omitted for the ID chip, which is active automatically and cannot be selected. */
  onActivate?: () => void;
  onRemove?: (() => void) | undefined;
}) {
  return (
    <li
      className={
        "flex h-6 select-none items-center rounded-full text-xs transition-opacity duration-300 " +
        tone +
        (active ? ` ring-1 ${ring}` : " " + FADED)
      }
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${prefix}${value}. ${hint}`}
        title={hint}
        // A single click does nothing; only a double click (or double tap, or Enter) activates.
        onDoubleClick={(e) => {
          e.preventDefault();
          onActivate?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onActivate?.();
        }}
        className={
          "max-w-[170px] truncate pl-2.5 font-mono font-medium " +
          (onActivate ? "cursor-pointer " : "cursor-default ") +
          (onRemove ? "pr-1" : "pr-2.5")
        }
      >
        {prefix}
        {value}
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${prefix}${value}`}
          onClick={onRemove}
          className="mr-1 flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition-opacity duration-300 hover:opacity-100"
        >
          <Icon name="ph:x" width={10} height={10} />
        </button>
      ) : null}
    </li>
  );
}
