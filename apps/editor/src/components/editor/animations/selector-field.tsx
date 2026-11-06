"use client";

import { walkElements } from "@nextomic/schema";
import { useMemo } from "react";
import { SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";
import { TextField, TipField } from "./fields";

interface Pick {
  value: string;
  label: string;
}

/** Elements of the open page that can be targeted: those with an ID, or with a class. */
function usePickable(): Pick[] {
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  return useMemo(() => {
    if (!tree) return [];
    const picks: Pick[] = [];
    walkElements(tree, (node) => {
      const name = node.name ?? node.type;
      if (node.htmlId) picks.push({ value: `#${node.htmlId}`, label: `${name}  #${node.htmlId}` });
      else if (node.classIds[0])
        picks.push({ value: `.${node.classIds[0]}`, label: `${name}  .${node.classIds[0]}` });
    });
    return picks;
  }, [tree]);
}

const NONE = "__none";

/**
 * A CSS selector box with a picker for elements of the open page. Typing works for anything the
 * picker cannot reach (a class shared by many elements, `h1`, `.card > img`).
 */
export function SelectorField({
  label,
  tip,
  value,
  onChange,
  allowThis = false,
  placeholder
}: {
  label: string;
  tip: string;
  value: string;
  onChange: (value: string) => void;
  allowThis?: boolean;
  placeholder?: string;
}) {
  const picks = usePickable();
  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        label={label}
        tip={tip}
        value={value}
        placeholder={placeholder ?? (allowThis ? "this" : ".my-class or #my-id")}
        onChange={onChange}
      />
      <TipField
        label="Pick an element"
        tip="Fills the box above with the ID (or first class) of an element on this page. Give an element an ID or a class in the Design panel for it to appear here."
      >
        <SelectField
          compact
          hideLabel
          label={`Pick an element for ${label}`}
          value={picks.some((p) => p.value === value) ? value : NONE}
          options={[
            {
              value: NONE,
              label: picks.length === 0 ? "No elements with an ID or class" : "Choose…"
            },
            ...(allowThis ? [{ value: "this", label: "this (the trigger element)" }] : []),
            ...picks
          ]}
          onValueChange={(next) => next !== NONE && onChange(next)}
        />
      </TipField>
    </div>
  );
}
