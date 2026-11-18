import { OPTION_VALUE_TYPES, listText, parseList, type OptionValueType } from "@nextomic/schema";

// How the runtime reads and writes the value of a form field (elements.md "Forms"). A field is the
// element marked `data-nxt-field`; its controls are the inputs inside it marked `data-nxt-control`.
// `data-nxt-kind` says how the controls make one value:
//   text   one control, its text (Input, Range, Date and time)
//   check  one checkbox, "true" or "false"
//   one    a group of radios, the checked one's value ("" when none)
//   many   a group of checkboxes, the checked values as a JSON list
//   pin    several one-character cells, joined

export type Control = HTMLInputElement | HTMLTextAreaElement;
export type FieldShape = "text" | "check" | "one" | "many" | "pin";

const SHAPES: readonly string[] = ["text", "check", "one", "many", "pin"];

export const controlsOf = (field: Element): Control[] => [
  ...field.querySelectorAll<Control>("[data-nxt-control]")
];

/** The data type of the field's option values (`data-nxt-value-type`); text when it says nothing. */
const valueTypeOf = (field: Element): OptionValueType =>
  OPTION_VALUE_TYPES.find((t) => t === field.getAttribute("data-nxt-value-type")) ?? "string";

export function shapeOf(field: Element): FieldShape {
  const kind = field.getAttribute("data-nxt-kind") ?? "text";
  return SHAPES.includes(kind) ? (kind as FieldShape) : "text";
}

const checkedOf = (controls: Control[]) =>
  controls.filter((c): c is HTMLInputElement => c instanceof HTMLInputElement && c.checked);

export function readField(field: Element): string {
  const controls = controlsOf(field);
  switch (shapeOf(field)) {
    case "check":
      return checkedOf(controls).length > 0 ? "true" : "false";
    case "one":
      return checkedOf(controls)[0]?.value ?? "";
    case "many":
      return listText(
        checkedOf(controls).map((c) => c.value),
        valueTypeOf(field)
      );
    case "pin":
      return controls.map((c) => c.value).join("");
    default:
      return controls[0]?.value ?? "";
  }
}

export function writeField(field: Element, value: string): void {
  const controls = controlsOf(field);
  switch (shapeOf(field)) {
    case "check":
      for (const c of controls) if (c instanceof HTMLInputElement) c.checked = value === "true";
      return;
    case "one":
      for (const c of controls) if (c instanceof HTMLInputElement) c.checked = c.value === value;
      return;
    case "many": {
      const chosen = new Set(parseList(value));
      for (const c of controls) if (c instanceof HTMLInputElement) c.checked = chosen.has(c.value);
      return;
    }
    case "pin": {
      const chars = [...value];
      controls.forEach((c, i) => {
        c.value = chars[i] ?? "";
        c.toggleAttribute("data-filled", c.value !== "");
      });
      return;
    }
    default:
      if (controls[0]) controls[0].value = value;
  }
}

/** The value the field had when the page was built. */
export function defaultOf(field: Element): string {
  const controls = controlsOf(field);
  const started = controls.filter(
    (c): c is HTMLInputElement => c instanceof HTMLInputElement && c.defaultChecked
  );
  switch (shapeOf(field)) {
    case "check":
      return started.length > 0 ? "true" : "false";
    case "one":
      return started[0]?.value ?? "";
    case "many":
      return listText(
        started.map((c) => c.value),
        valueTypeOf(field)
      );
    case "pin":
      return controls.map((c) => c.defaultValue).join("");
    default:
      return controls[0]?.defaultValue ?? "";
  }
}

export function isEmptyField(field: Element): boolean {
  const value = readField(field);
  switch (shapeOf(field)) {
    case "check":
      return value !== "true";
    case "many":
      return parseList(value).length === 0;
    default:
      return value.trim() === "";
  }
}

/** The control that takes focus when the field is cleared or has an error. */
export function focusTarget(field: Element): Control | null {
  const controls = controlsOf(field);
  switch (shapeOf(field)) {
    case "one":
    case "many":
      return checkedOf(controls)[0] ?? controls.find((c) => !c.disabled) ?? null;
    case "pin":
      return controls.find((c) => c.value === "") ?? controls[0] ?? null;
    default:
      return controls[0] ?? null;
  }
}
