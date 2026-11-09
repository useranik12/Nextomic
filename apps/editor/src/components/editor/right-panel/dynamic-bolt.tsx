"use client";

import { parseTransformChain, splitTemplate, tagText, type TransformChain } from "@nextomic/schema";
import { useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { asExpressionField, replaceInField, type TextField } from "../expression/expression-field";
import { DynamicDataModal, type Exclude } from "./dynamic-data-modal";

/** A tag already in the field that the bolt reopens in the Transform view. */
interface EditTarget {
  field: TextField;
  start: number;
  end: number;
  chain: TransformChain;
}

/** The field this bolt belongs to (the text field near it). */
function fieldOf(button: HTMLElement): TextField | null {
  let node: HTMLElement | null = button.parentElement;
  for (let level = 0; node && level < 5; level++, node = node.parentElement) {
    const field = asExpressionField(node.querySelector("input, textarea"));
    if (field) return field;
  }
  return null;
}

/** The transformable tag under the caret of a focused field, if there is one. */
function tagAtCaret(field: TextField): EditTarget | null {
  const caret = field.selectionStart ?? -1;
  for (const part of splitTemplate(field.value)) {
    if (typeof part === "string" || caret <= part.start || caret >= part.end) continue;
    const chain = parseTransformChain(part.expr);
    return chain ? { field, start: part.start, end: part.end, chain } : null;
  }
  return null;
}

/**
 * The bolt on a field. It opens a large modal of dynamic tags grouped by source, with a filter and
 * group chips; picking a tag inserts it into the field as a {{ token }}. A tag can be opened in the
 * Transform view first; with the caret inside a tag, the bolt reopens that tag's transforms.
 */
export function DynamicBolt({
  label,
  onInsert,
  disabledReason,
  exclude,
  serverRun = false
}: {
  label: string;
  onInsert: (token: string) => void;
  /** When set the bolt is shown but cannot be used yet, and this says why. */
  disabledReason?: string;
  /** Page groups this field must not reference (its own parameters or state variables). */
  exclude?: Exclude;
  /** A field filled and used only on the server (query settings): it may read the raw token. */
  serverRun?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);
  // Read on pointer down: by click time the field has already lost focus to the bolt.
  const pending = useRef<EditTarget | null>(null);
  const button =
    "flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 " +
    (disabledReason
      ? "text-default-300"
      : "text-yellow-500 hover:bg-default-200 hover:text-yellow-400 dark:text-yellow-400");

  if (disabledReason) {
    return (
      <button
        type="button"
        data-dynamic-bolt
        aria-label={`Dynamic value for ${label} (unavailable)`}
        title={disabledReason}
        aria-disabled="true"
        className={button + " cursor-not-allowed"}
      >
        <Icon name="ph:lightning" width={14} height={14} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        data-dynamic-bolt
        aria-label={`Dynamic value for ${label}`}
        onPointerDown={(event) => {
          const field = fieldOf(event.currentTarget);
          pending.current = field && document.activeElement === field ? tagAtCaret(field) : null;
        }}
        onClick={() => {
          setTarget(pending.current);
          pending.current = null;
          setOpen(true);
        }}
        className={button}
      >
        <Icon name="ph:lightning" width={14} height={14} />
      </button>
      {open ? (
        <DynamicDataModal
          title={label}
          exclude={exclude}
          serverRun={serverRun}
          initialTransform={target?.chain ?? null}
          onClose={() => setOpen(false)}
          onPick={(token) => {
            setOpen(false);
            if (!target) return onInsert(token);
            // The modal hands focus back as it closes; edit the field after that, or the edit
            // lands at the old caret instead of replacing the tag.
            const text = tagText(token);
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                replaceInField(
                  target.field,
                  target.start,
                  target.end,
                  text,
                  target.start + text.length
                )
              )
            );
          }}
        />
      ) : null}
    </>
  );
}
