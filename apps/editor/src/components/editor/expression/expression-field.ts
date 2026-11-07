// DOM helpers for expression fields: which fields take expressions, and how to change a
// React-controlled field's value from outside so React sees it and the browser's undo keeps it.

export type TextField = HTMLInputElement | HTMLTextAreaElement;

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", ""]);

/** A text field that takes {{expressions}}: one that has the dynamic bolt beside it. */
export function asExpressionField(target: EventTarget | null): TextField | null {
  const el =
    target instanceof HTMLTextAreaElement
      ? target
      : target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)
        ? target
        : null;
  if (!el || el.closest("[data-expression-panel]")) return null;
  let node: HTMLElement | null = el.parentElement;
  for (let level = 0; node && level < 5; level++, node = node.parentElement)
    if (node.querySelector("[data-dynamic-bolt]")) return el;
  return null;
}

/**
 * Replaces `from..to` of the field's text with `text` the way typing would: React's onChange runs
 * and Ctrl+Z in the field undoes it. Then puts the caret at `caret`.
 */
export function replaceInField(
  el: TextField,
  from: number,
  to: number,
  text: string,
  caret: number
): void {
  el.focus();
  el.setSelectionRange(from, to);
  // execCommand is the only way to edit a field that keeps the browser's own undo history.
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const value = el.value.slice(0, from) + text + el.value.slice(to);
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.setSelectionRange(caret, caret);
}
