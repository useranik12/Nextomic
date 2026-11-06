"use client";

import {
  elementSelectorLabel,
  parseStyleCss,
  styleMapToCss,
  type ElementNode,
  type StyleMap
} from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { CssCodeEditor } from "@/components/ui/code-editor";
import { useEditorStore } from "../store/editor-store";

/**
 * The CSS text of the active target (the active class, else the element), kept in step with the
 * visual controls both ways. Typing valid CSS updates the styles at once; invalid CSS shows the
 * error and leaves the last valid styles untouched.
 */
export function CssEditor({ node }: { node: ElementNode }) {
  const activeClass = useEditorStore((s) => s.activeClass);
  const breakpoints = useEditorStore((s) => s.project.breakpoints);
  const classStyles = useEditorStore((s) => (activeClass ? s.project.classes[activeClass] : null));
  const setTargetStyles = useEditorStore((s) => s.setTargetStyles);
  const styles: StyleMap = (activeClass ? classStyles : node.styles) ?? { breakpoints: {} };
  const selector = activeClass ? `.${activeClass}` : elementSelectorLabel(node);
  const generated = styleMapToCss(styles, selector, breakpoints);

  const [text, setText] = useState(generated);
  const [error, setError] = useState<{ message: string; line: number | null } | null>(null);
  const focused = useRef(false);

  // Visual edits and target switches refresh the text, unless the user is typing in it.
  useEffect(() => {
    if (focused.current) return;
    setText(generated);
    setError(null);
  }, [generated, selector]);

  function onChange(next: string) {
    setText(next);
    const result = parseStyleCss(next, selector, breakpoints);
    if (!result.ok) {
      setError({ message: result.error, line: result.line });
      return;
    }
    setError(null);
    setTargetStyles(node.id, result.styles);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <CssCodeEditor
        label={`CSS for ${selector}`}
        invalid={error !== null}
        value={text}
        placeholder={`${selector} {
  color: red;
}`}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          if (error === null) setText(generated);
        }}
        onChange={onChange}
      />
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error.line ? `Line ${error.line}: ` : ""}
          {error.message}. The last valid CSS is still applied.
        </p>
      ) : (
        <p className="text-tiny text-default-500">
          Edits here and in the controls above stay in sync. Anything the controls cannot show is
          kept as written.
        </p>
      )}
    </div>
  );
}
