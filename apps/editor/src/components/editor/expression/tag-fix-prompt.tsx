"use client";

import { fixedTag, unspacedTags, type UnspacedTag } from "@nextomic/schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { placeFloating } from "@/lib/place-floating";
import { asExpressionField, replaceInField, type TextField } from "./expression-field";

// A tag needs a space inside both braces ({{ user.name }}); {{user.name}} is plain text. When an
// edit to a field with the dynamic bolt adds such a {{x}}, this asks whether to make it a tag
// ("Fix tag" adds the spaces) or leave it as text. It never takes focus from the field.

interface Prompt {
  el: TextField;
  tags: UnspacedTag[];
}

const SIZE = { width: 320, height: 132 };
const key = (tag: UnspacedTag) => `{{${tag.inner}}}`;

/** The unspaced tags in `after` that `before` did not have (counted, so a second copy is new). */
function addedTags(before: string, after: string): UnspacedTag[] {
  const had = new Map<string, number>();
  for (const tag of unspacedTags(before)) had.set(key(tag), (had.get(key(tag)) ?? 0) + 1);
  return unspacedTags(after).filter((tag) => {
    const left = had.get(key(tag)) ?? 0;
    if (left > 0) {
      had.set(key(tag), left - 1);
      return false;
    }
    return true;
  });
}

export function TagFixPrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = new WeakMap<TextField, string>();
    const onBeforeInput = (e: Event) => {
      const el = asExpressionField(e.target);
      if (el) before.set(el, el.value);
    };
    const onInput = (e: Event) => {
      const el = asExpressionField(e.target);
      if (!el) return;
      const added = addedTags(before.get(el) ?? "", el.value);
      if (added.length > 0) setPrompt({ el, tags: added });
      else setPrompt((current) => (current?.el === el ? null : current));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrompt(null);
    };
    const onBlur = (e: FocusEvent) => {
      const inside = e.relatedTarget instanceof Node && boxRef.current?.contains(e.relatedTarget);
      if (!inside) setPrompt((current) => (current?.el === e.target ? null : current));
    };
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusout", onBlur, true);
    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusout", onBlur, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!prompt) return setPlace(null);
    const rect = prompt.el.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPlace(placeFloating(rect, SIZE, viewport, { prefer: "bottom" }));
  }, [prompt]);

  if (!prompt || !place) return null;

  const fix = () => {
    const { el } = prompt;
    // Tags that are still in the field as written, last first so earlier offsets stay right.
    const current = unspacedTags(el.value).filter((t) =>
      prompt.tags.some((p) => key(p) === key(t))
    );
    let caret = el.selectionStart ?? el.value.length;
    for (const tag of [...current].reverse()) {
      const text = fixedTag(tag);
      if (caret >= tag.end) caret += text.length - (tag.end - tag.start);
      replaceInField(el, tag.start, tag.end, text, tag.start + text.length);
    }
    el.setSelectionRange(caret, caret);
    setPrompt(null);
  };
  const first = prompt.tags[0];
  const label = first ? key(first) : "";

  return (
    <div
      ref={boxRef}
      role="alertdialog"
      aria-label="Make this a dynamic tag?"
      data-expression-panel
      style={{ left: place.left, top: place.top, width: SIZE.width }}
      className="fixed z-[70] flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg"
    >
      <p className="text-xs text-body">
        <code className="font-mono text-foreground">{label}</code>
        {prompt.tags.length > 1 ? ` and ${prompt.tags.length - 1} more` : ""} has no space inside
        the braces, so it shows as plain text. Tags are written{" "}
        <code className="font-mono text-foreground">{first ? fixedTag(first) : "{{ tag }}"}</code>.
      </p>
      <div className="flex justify-end gap-2">
        <ActionButton
          size="sm"
          tone="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onPress={() => setPrompt(null)}
        >
          Keep as text
        </ActionButton>
        <ActionButton size="sm" onMouseDown={(e) => e.preventDefault()} onPress={fix}>
          Fix tag
        </ActionButton>
      </div>
    </div>
  );
}
