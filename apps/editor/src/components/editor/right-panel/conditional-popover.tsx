"use client";

import {
  dynamicTextOf,
  parseDynamicText,
  type ConditionalCase,
  type ConditionalValue,
  type ElementNode,
  type PlainValue
} from "@nextomic/schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { placeBeside } from "@/lib/place-floating";
import { ConditionGroupEditor, newCondition } from "../conditions/condition-group-editor";
import { useEditorStore } from "../store/editor-store";
import { BoltInput } from "./bolt-input";
import {
  fixedValueOf,
  MAX_CONDITIONAL_CASES,
  totalConditions,
  type ValueKind
} from "./conditional-value";

interface Option {
  value: string;
  label: string;
}

/** The editor of one case value or the Else value, by the kind of prop. */
function ValueField({
  label,
  kind,
  options,
  value,
  onChange
}: {
  label: string;
  kind: ValueKind;
  options: Option[];
  value: PlainValue;
  onChange: (next: PlainValue) => void;
}) {
  if (kind === "switch")
    return (
      <SelectField
        compact
        label={label}
        options={[
          { value: "on", label: "On" },
          { value: "off", label: "Off" }
        ]}
        value={value === true || value === "true" ? "on" : "off"}
        onValueChange={(next) => onChange(next === "on")}
      />
    );
  if (kind === "select")
    return (
      <SelectField
        compact
        label={label}
        options={options}
        value={dynamicTextOf(value)}
        onValueChange={onChange}
      />
    );
  return (
    <BoltInput
      label={label}
      value={dynamicTextOf(value)}
      onValueChange={(text) => onChange(parseDynamicText(text))}
    />
  );
}

const iconButton =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-300 hover:bg-default hover:text-foreground disabled:opacity-40";

const FOCUSABLE = "button, input, textarea, [tabindex]:not([tabindex='-1'])";

/**
 * The cases of a conditional value, in a panel that is only as big as its content. It sits beside
 * the field (left over the canvas first), flips by the room there is, traps focus and closes on
 * Escape or a click outside. Dialogs opened from inside it (the bolt) do not count as outside.
 */
export function ConditionalPopover({
  node,
  propKey,
  label,
  kind,
  options,
  value,
  anchor,
  onChange,
  onFixed,
  onClose
}: {
  node: ElementNode;
  propKey: string;
  label: string;
  kind: ValueKind;
  options: Option[];
  value: ConditionalValue;
  anchor: HTMLElement;
  onChange: (next: ConditionalValue) => void;
  onFixed: (next: PlainValue) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const previewKey = `${node.id}:${propKey}`;
  const preview = useEditorStore((s) => s.valuePreview[previewKey]);
  const setPreview = useEditorStore((s) => s.setValuePreview);
  const total = totalConditions(value);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const position = () => {
      const rect = el.getBoundingClientRect();
      const next = placeBeside(
        anchor.getBoundingClientRect(),
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPlace((old) =>
        old && old.left === next.left && old.top === next.top
          ? old
          : { left: next.left, top: next.top }
      );
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(el);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
    };
  }, [anchor]);

  useEffect(() => {
    box.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || box.current?.contains(target) || anchor.contains(target)) return;
      // Dialogs and menus opened from inside the panel (the bolt, a select) are not outside.
      if (target.closest("[role=dialog], [role=listbox], [role=menu], [data-overlay]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [anchor, onClose]);

  const setCase = (index: number, next: ConditionalCase) =>
    onChange({ ...value, cases: value.cases.map((c, i) => (i === index ? next : c)) });
  const move = (index: number, by: number) => {
    const cases = [...value.cases];
    const [item] = cases.splice(index, 1);
    if (!item) return;
    cases.splice(index + by, 0, item);
    onChange({ ...value, cases });
    if (preview !== undefined) setPreview(previewKey, null);
  };
  const remove = (index: number) => {
    onChange({ ...value, cases: value.cases.filter((_, i) => i !== index) });
    if (typeof preview === "number") setPreview(previewKey, null);
  };
  const add = () =>
    onChange({
      ...value,
      cases: [
        ...value.cases,
        {
          id: crypto.randomUUID(),
          if: { id: crypto.randomUUID(), match: "all", items: [newCondition()] },
          then: kind === "switch" ? true : ""
        }
      ]
    });
  const close = () => {
    onClose();
    anchor.focus();
  };

  const previewOptions = [
    { value: "auto", label: "Auto" },
    ...value.cases.map((_, i) => ({ value: String(i), label: `Case ${i + 1}` })),
    { value: "else", label: "Else" }
  ];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      const items = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (el) => !el.hasAttribute("disabled")
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={`Conditional value for ${label}`}
      tabIndex={-1}
      data-conditional-popover
      onKeyDown={onKeyDown}
      style={{
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        visibility: place ? "visible" : "hidden"
      }}
      className="fixed z-[900] flex max-h-[calc(100vh-1rem)] w-[min(22rem,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-overlay p-3 shadow-overlay outline-none"
    >
      <div className="flex items-center gap-1">
        <Icon name="ph:git-fork" width={14} height={14} className="text-muted" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {label}: conditional value
        </h3>
        <button type="button" aria-label="Close" onClick={close} className={iconButton}>
          <Icon name="ph:x" width={14} height={14} />
        </button>
      </div>
      {value.cases.length === 0 ? (
        <p className="text-xs text-muted">
          Add a case to choose the value by conditions. With no case that holds, the Else value is
          used.
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {value.cases.map((item, index) => (
          <li
            key={item.id}
            aria-label={`Case ${index + 1}`}
            className="flex flex-col gap-2 rounded-xl border border-border p-2"
          >
            <div className="flex items-center gap-1">
              <span className="flex-1 text-xs font-semibold text-body">If (case {index + 1})</span>
              <button
                type="button"
                aria-label={`Move case ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className={iconButton}
              >
                <Icon name="ph:arrow-up" width={14} height={14} />
              </button>
              <button
                type="button"
                aria-label={`Move case ${index + 1} down`}
                disabled={index === value.cases.length - 1}
                onClick={() => move(index, 1)}
                className={iconButton}
              >
                <Icon name="ph:arrow-down" width={14} height={14} />
              </button>
              <button
                type="button"
                aria-label={`Remove case ${index + 1}`}
                onClick={() => remove(index)}
                className={iconButton + " hover:text-danger"}
              >
                <Icon name="ph:trash" width={14} height={14} />
              </button>
            </div>
            <ConditionGroupEditor
              group={item.if}
              depth={1}
              total={total}
              onChange={(group) => setCase(index, { ...item, if: group })}
            />
            <ValueField
              label={`Then (case ${index + 1})`}
              kind={kind}
              options={options}
              value={item.then}
              onChange={(then) => setCase(index, { ...item, then })}
            />
          </li>
        ))}
      </ol>
      <ActionButton
        tone="ghost"
        size="sm"
        isDisabled={value.cases.length >= MAX_CONDITIONAL_CASES}
        startContent={<Icon name="ph:plus" width={14} height={14} />}
        onPress={add}
      >
        Add case
      </ActionButton>
      <ValueField
        label="Else"
        kind={kind}
        options={options}
        value={value.otherwise}
        onChange={(otherwise) => onChange({ ...value, otherwise })}
      />
      <SelectField
        compact
        label="Canvas preview"
        options={previewOptions}
        value={preview === undefined ? "auto" : String(preview)}
        onValueChange={(next) =>
          setPreview(previewKey, next === "auto" ? null : next === "else" ? "else" : Number(next))
        }
      />
      <ActionButton
        tone="ghost"
        size="sm"
        onPress={() => {
          setPreview(previewKey, null);
          onFixed(fixedValueOf(value));
          close();
        }}
      >
        Use a fixed value
      </ActionButton>
    </div>,
    document.body
  );
}
