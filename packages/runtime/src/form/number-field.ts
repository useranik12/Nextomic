import {
  holdNumber,
  numberFromText,
  numberSpecOf,
  numberText,
  stepNumber,
  type NumberSpec
} from "@nextomic/schema";

// Number fields of a built page (elements.md "Forms"): the Count Controller and the Range slider.
// The control (`data-nxt-control`) holds the number as text. This module runs the counter's buttons
// and keys, keeps what the visitor sees in step with the value (button limits, the slider's fill,
// the value readout) and does it for writes made by actions too. It works on any page, inside a
// form or not; only validation and the Form tags need the form.

export const NUMBER_FIELD = '[data-nxt-field][data-nxt-kind="number"]';

const attrOf = (field: Element, name: string) => field.getAttribute(name) ?? "";

/** The limits and step a field was drawn with. */
export function specOf(field: Element): NumberSpec {
  const get = (key: string) =>
    key === "min"
      ? attrOf(field, "data-nxt-min")
      : key === "max"
        ? attrOf(field, "data-nxt-max")
        : key === "step"
          ? attrOf(field, "data-nxt-step-size")
          : "";
  return numberSpecOf(get);
}

const controlOf = (field: Element) => field.querySelector<HTMLInputElement>("[data-nxt-control]");

/** The share of the way from the minimum to the maximum, 0 to 1 (0 when a limit is open). */
function fractionOf(value: number, spec: NumberSpec): number {
  if (spec.min === null || spec.max === null || spec.max === spec.min) return 0;
  return (value - spec.min) / (spec.max - spec.min);
}

/** Brings everything a visitor sees in line with the value of one number field. */
export function syncNumberField(field: Element): void {
  const control = controlOf(field);
  if (!control) return;
  const spec = specOf(field);
  const value = holdNumber(numberFromText(control.value), spec);
  control.setAttribute("aria-valuenow", numberText(value));
  for (const button of field.querySelectorAll<HTMLButtonElement>("[data-nxt-step]")) {
    const down = Number(button.getAttribute("data-nxt-step")) < 0;
    const atLimit = down
      ? spec.min !== null && value <= spec.min
      : spec.max !== null && value >= spec.max;
    button.disabled = control.disabled || atLimit;
  }
  const range = field.querySelector<HTMLElement>("[data-nxt-range]");
  range?.style.setProperty("--nxt-p", String(fractionOf(value, spec)));
  const readout = field.querySelector<HTMLElement>("[data-nxt-value]");
  if (readout) {
    const text = `${readout.getAttribute("data-prefix") ?? ""}${numberText(value)}${readout.getAttribute("data-suffix") ?? ""}`;
    readout.textContent = text;
    // A slider says its value with the unit (a screen reader reads "40 percent", not just "40").
    if (control.type === "range") control.setAttribute("aria-valuetext", text);
  }
}

/** Writes a number into a field, held inside its limits, and refreshes what the visitor sees. */
export function writeNumber(field: Element, text: string): void {
  const control = controlOf(field);
  if (!control) return;
  control.value = numberText(holdNumber(numberFromText(text), specOf(field)));
  syncNumberField(field);
}

/** Refreshes every number field inside `root` (after a redraw or at the start). */
export function syncNumbers(root: ParentNode): void {
  root.querySelectorAll(NUMBER_FIELD).forEach(syncNumberField);
}

const fieldOf = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target.closest(NUMBER_FIELD) : null;

/** Moves the counter by `times` steps and tells listeners the value changed. */
function nudge(field: Element, times: number): void {
  const control = controlOf(field);
  if (!control || control.disabled) return;
  const spec = specOf(field);
  const next = stepNumber(holdNumber(numberFromText(control.value), spec), spec, times);
  if (numberText(next) === control.value) return;
  control.value = numberText(next);
  syncNumberField(field);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

export function startNumberFields(root: Document): () => void {
  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest("[data-nxt-step]") : null;
    const field = fieldOf(button);
    if (!button || !field) return;
    nudge(field, Number(button.getAttribute("data-nxt-step")));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const control =
      event.target instanceof Element ? event.target.closest("[data-nxt-count]") : null;
    const field = fieldOf(control);
    if (!control || !field) return;
    const spec = specOf(field);
    const jump: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    const times = jump[event.key];
    if (times !== undefined) {
      event.preventDefault();
      nudge(field, times);
    } else if (event.key === "Home" && spec.min !== null) {
      event.preventDefault();
      nudge(field, Number.NEGATIVE_INFINITY);
    } else if (event.key === "End" && spec.max !== null) {
      event.preventDefault();
      nudge(field, Number.POSITIVE_INFINITY);
    }
  };
  // The slider's own `input` event (dragging, arrow keys) moves the fill and the readout.
  const onInput = (event: Event) => {
    const field = fieldOf(event.target);
    if (field && event.target instanceof HTMLInputElement && event.target.type === "range")
      syncNumberField(field);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("input", onInput, true);
  syncNumbers(root);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown);
    root.removeEventListener("input", onInput, true);
  };
}
