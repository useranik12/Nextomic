"use client";

import type { ElementNode } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { validClassName } from "../design-system/classes/class-edit-panel";
import { useEditorStore } from "../store/editor-store";

/** Moves the element's own styles (every breakpoint and state) into a new class on the element. */
export function ConvertToClass({ node }: { node: ElementNode }) {
  const convert = useEditorStore((s) => s.convertStylesToClass);
  const classes = useEditorStore((s) => s.project.classes);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasStyles = Object.values(node.styles.breakpoints).some((byState) =>
    Object.values(byState).some((decls) => Object.keys(decls).length > 0)
  );

  function submit() {
    const trimmed = name.trim().replace(/^\./, "");
    const problem = validClassName(trimmed);
    if (problem) return setError(problem);
    if (classes[trimmed]) return setError("That class already exists.");
    if (!convert(node.id, trimmed)) return setError("This element has no styles to move.");
    setError(null);
    setName("");
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-default p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`convert-${node.id}`} className="text-sm font-semibold text-foreground">
        Convert styles to a class
      </label>
      <p className="text-xs text-muted">
        Moves this element&apos;s own styles into a new class and adds it to the element. The
        element looks the same.
      </p>
      <div className="flex items-center gap-2">
        <input
          id={`convert-${node.id}`}
          value={name}
          placeholder="class-name"
          disabled={!hasStyles}
          onChange={(e) => setName(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-transparent px-3 font-mono text-sm outline-none focus-visible:border-focus disabled:opacity-50"
        />
        <ActionButton size="sm" type="submit" isDisabled={!hasStyles || name.trim() === ""}>
          Convert
        </ActionButton>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
