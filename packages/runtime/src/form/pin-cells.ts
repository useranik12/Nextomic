import { pinAccepts, pinCharsetOf, pinFill, type PinCharset } from "@nextomic/schema";

// Typing in a PIN / OTP field (elements.md "Forms"): the boxes are separate inputs, so this module
// keeps them behaving as one code. Typing moves to the next box, Backspace on an empty box goes
// back, the arrows walk the boxes, and a pasted or autofilled code spreads over all of them. It
// only edits the boxes; the form runtime reads the joined value and does validation.

const FIELD = '[data-nxt-field][data-nxt-kind="pin"]';
const CELL = "[data-nxt-cell]";

type Box = HTMLInputElement;

const boxesOf = (field: Element): Box[] => [...field.querySelectorAll<Box>(CELL)];

/** Shows whether a box holds a character (the Filled state of the design reads this). */
export const markFilled = (box: Box): void => {
  box.toggleAttribute("data-filled", box.value !== "");
};

const hitOf = (target: EventTarget | null) => {
  const box = target instanceof HTMLInputElement && target.matches(CELL) ? target : null;
  const field = box?.closest(FIELD) ?? null;
  if (!box || !field) return null;
  const boxes = boxesOf(field);
  const charset: PinCharset = pinCharsetOf(field.getAttribute("data-nxt-charset"));
  return { box, field, boxes, index: boxes.indexOf(box), charset };
};

/**
 * Puts `text` in from the box that took it and moves focus to the next box. When the box was typed
 * in, what it holds now is the browser's edit, not a value to keep, so it starts empty.
 */
function spread(hit: NonNullable<ReturnType<typeof hitOf>>, text: string, typed: boolean): void {
  const filled = pinFill(
    hit.boxes.map((b, i) => (typed && i === hit.index ? "" : b.value)),
    hit.index,
    text,
    hit.charset
  );
  hit.boxes.forEach((b, i) => {
    b.value = filled.boxes[i] ?? "";
    markFilled(b);
  });
  hit.boxes[filled.focus]?.focus();
}

/** Tells the form runtime the value changed (it listens for `input` on the boxes). */
const announce = (box: Box): void => {
  box.dispatchEvent(new Event("input", { bubbles: true }));
};

export function startPinCells(root: Document): () => void {
  // The form runtime listens to the same `input` events later (bubbling), so by then the boxes
  // already hold the final, filtered text.
  let announcing = false;
  const onInput = (event: Event) => {
    const hit = hitOf(event.target);
    if (!hit || announcing) return;
    const typed = event instanceof InputEvent && event.data ? event.data : hit.box.value;
    if (typed === "") {
      hit.box.value = "";
      markFilled(hit.box);
      return;
    }
    spread(hit, typed, true);
  };
  // A single character the field does not accept never reaches the box.
  const onBeforeInput = (event: InputEvent) => {
    const hit = hitOf(event.target);
    if (!hit || event.inputType !== "insertText" || !event.data) return;
    if ([...event.data].length === 1 && !pinAccepts(hit.charset, event.data))
      event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const hit = hitOf(event.target);
    if (!hit || event.ctrlKey || event.metaKey || event.altKey) return;
    const go = (index: number) => {
      event.preventDefault();
      const box = hit.boxes[Math.max(0, Math.min(hit.boxes.length - 1, index))];
      box?.focus();
    };
    switch (event.key) {
      case "Backspace":
        if (hit.box.value === "" && hit.index > 0) {
          event.preventDefault();
          const previous = hit.boxes[hit.index - 1];
          if (!previous) return;
          previous.value = "";
          markFilled(previous);
          previous.focus();
          announcing = true;
          announce(previous);
          announcing = false;
        }
        return;
      case "ArrowLeft":
        return go(hit.index - 1);
      case "ArrowRight":
        return go(hit.index + 1);
      case "Home":
        return go(0);
      case "End":
        return go(hit.boxes.length - 1);
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    const hit = hitOf(event.target);
    if (!hit) return;
    event.preventDefault();
    spread(hit, event.clipboardData?.getData("text") ?? "", false);
    announcing = true;
    announce(hit.box);
    announcing = false;
  };
  const onFocusIn = (event: FocusEvent) => {
    hitOf(event.target)?.box.select();
  };

  root.addEventListener("beforeinput", onBeforeInput);
  root.addEventListener("input", onInput, true);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("paste", onPaste);
  root.addEventListener("focusin", onFocusIn);
  return () => {
    root.removeEventListener("beforeinput", onBeforeInput);
    root.removeEventListener("input", onInput, true);
    root.removeEventListener("keydown", onKeyDown);
    root.removeEventListener("paste", onPaste);
    root.removeEventListener("focusin", onFocusIn);
  };
}
