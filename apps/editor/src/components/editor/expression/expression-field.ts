// DOM helpers for the expression autocomplete: which fields take expressions, and how to change a
// React-controlled field's value from outside so React sees the change.

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
  if (!el) return null;
  let node: HTMLElement | null = el.parentElement;
  for (let level = 0; node && level < 5; level++, node = node.parentElement)
    if (node.querySelector("[data-dynamic-bolt]")) return el;
  return null;
}

/** Sets the value the way typing would, so React's onChange runs. */
export function setFieldValue(el: TextField, value: string, caret: number): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}
