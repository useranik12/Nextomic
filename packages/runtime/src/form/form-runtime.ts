import {
  validateValue,
  type FieldValueKind,
  DATE_MODES,
  type FieldRules,
  type InputType,
  INPUT_TYPES
} from "@nextomic/schema";
import {
  controlsOf,
  defaultOf,
  focusTarget,
  isEmptyField,
  readField,
  shapeOf,
  writeField,
  type Control
} from "./field-values";
import { startDateFields, syncDates } from "./date-field";
import { startSelects, syncSelects } from "./select-field";
import { startNumberFields, syncNumbers } from "./number-field";
import { startPinCells } from "./pin-cells";

// Form behavior of a built page (elements.md "Forms"): the DOM is the source of values. The runtime
// shows validation errors, runs the clear and show/hide-password buttons, stops the browser's own
// submit, and answers the Form actions (validate, set, reset, clear). A change is reported by name
// ("form.signup.email") so elements that read it redraw like they do for state.

export interface FormCheck {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export interface FormRuntime {
  /** Values by form then field. Password fields are left out unless asked for. */
  values: (includePasswords: boolean) => Record<string, Record<string, string>>;
  /** Whether the page has an active form with this name. */
  has: (form: string) => boolean;
  validate: (form: string) => FormCheck;
  /** Each returns the changed names ("form.signup.email"). */
  set: (form: string, values: Readonly<Record<string, string>>) => string[];
  reset: (form: string) => string[];
  clear: (form: string) => string[];
  /** Refreshes buttons of fields inside `root` (after a redraw). */
  sync: (root: ParentNode) => void;
  stop: () => void;
}

const FORM = "form[data-nxt-form]:not([data-nxt-inactive])";
const NUMBER = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const controlOf = (field: Element): Control | null => controlsOf(field)[0] ?? null;
const fieldNameOf = (field: Element) => field.getAttribute("data-nxt-field") ?? "";
const fieldsOf = (form: Element) => [...form.querySelectorAll("[data-nxt-field]")];

function parseRules(field: Element): Omit<FieldRules, "matchValue"> & { matchField: string } {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(field.getAttribute("data-nxt-rules") ?? "{}");
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const type = INPUT_TYPES.find((t): t is InputType => t === raw.type) ?? "text";
  const messages = raw.messages && typeof raw.messages === "object" ? raw.messages : {};
  return {
    type,
    kind: (["text", "check", "many"] as const).find((k): k is FieldValueKind => k === raw.kind),
    minSelected: NUMBER(raw.minSelected),
    maxSelected: NUMBER(raw.maxSelected),
    required: raw.required === true,
    minLength: NUMBER(raw.minLength),
    maxLength: NUMBER(raw.maxLength),
    min: NUMBER(raw.min),
    max: NUMBER(raw.max),
    dateMode: DATE_MODES.find((m) => m === raw.dateMode) ?? null,
    minDate: typeof raw.minDate === "string" ? raw.minDate : "",
    maxDate: typeof raw.maxDate === "string" ? raw.maxDate : "",
    pattern: typeof raw.pattern === "string" ? raw.pattern : "",
    matchField: typeof raw.matchField === "string" ? raw.matchField : "",
    messages: messages as FieldRules["messages"]
  };
}

export function startFormRuntime(
  onChange: (names: string[]) => void,
  root: Document = document
): FormRuntime {
  const touched = new WeakSet<Element>();
  const stops: (() => void)[] = [];
  const listen = <K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
    capture = false
  ) => {
    root.addEventListener(type, fn, capture);
    stops.push(() => root.removeEventListener(type, fn, capture));
  };

  stops.push(
    startPinCells(root),
    startNumberFields(root),
    startDateFields(root),
    startSelects(root)
  );
  const forms = () => [...root.querySelectorAll<HTMLFormElement>(FORM)];
  const formNamed = (name: string) =>
    forms().find((f) => f.getAttribute("data-nxt-form") === name) ?? null;
  const tag = (form: Element, field: Element) =>
    `form.${form.getAttribute("data-nxt-form") ?? ""}.${fieldNameOf(field)}`;

  const showError = (field: Element, message: string | null, mark = true) => {
    const error = field.querySelector("[data-nxt-error]");
    if (error) {
      error.textContent = message ?? "";
      error.toggleAttribute("hidden", !message);
    }
    for (const control of controlsOf(field))
      control.setAttribute("aria-invalid", message ? "true" : "false");
    // A Select shows its state on the field the visitor can reach, not on its hidden inputs.
    field
      .querySelector("[data-nxt-trigger]")
      ?.setAttribute("aria-invalid", message ? "true" : "false");
    field.toggleAttribute("data-invalid", Boolean(message));
    // A checked, filled field that passes shows its success text (when it has any).
    const success = field.querySelector("[data-nxt-success]");
    // A number is never empty, so it counts as passed only when it has a success text to show.
    const valid =
      mark &&
      !message &&
      !isEmptyField(field) &&
      (shapeOf(field) !== "number" || Boolean(success?.textContent));
    field.toggleAttribute("data-valid", valid);
    if (success) success.toggleAttribute("hidden", !valid || !success.textContent);
  };

  const checkField = (form: Element, field: Element, show: boolean): string | null => {
    const controls = controlsOf(field);
    if (controls.length === 0) return null;
    // A disabled field keeps its value for actions but is never validated (a disabled Required
    // field must not block the form), so a stale error is cleared too.
    if (controls.every((c) => c.disabled)) {
      if (show) showError(field, null, false);
      return null;
    }
    const { matchField, ...rest } = parseRules(field);
    const other = matchField
      ? fieldsOf(form).find((f) => fieldNameOf(f) === matchField)
      : undefined;
    const matchValue = other ? readField(other) : null;
    const message = validateValue(readField(field), { ...rest, matchValue });
    if (show) showError(field, message);
    return message;
  };

  const syncButtons = (field: Element) => {
    const clear = field.querySelector<HTMLElement>("[data-nxt-clear]");
    if (clear) clear.toggleAttribute("hidden", isEmptyField(field));
  };

  const fieldOfTarget = (target: EventTarget | null) => {
    const el = target instanceof Element ? target : null;
    const field = el?.closest("[data-nxt-field]") ?? null;
    const form = field?.closest(FORM) ?? null;
    return field && form ? { field, form } : null;
  };
  const isControl = (target: EventTarget | null) =>
    target instanceof Element && target.matches("[data-nxt-control]");
  const mode = (form: Element) => form.getAttribute("data-nxt-validate-on") ?? "blurThenChange";

  listen("input", (e) => {
    const hit = fieldOfTarget(e.target);
    if (!hit || !isControl(e.target)) return;
    syncButtons(hit.field);
    const when = mode(hit.form);
    if (when === "change" || (when === "blurThenChange" && touched.has(hit.field)))
      checkField(hit.form, hit.field, true);
    onChange([tag(hit.form, hit.field)]);
  });
  listen("focusout", (e) => {
    const hit = fieldOfTarget(e.target);
    if (!hit || !isControl(e.target)) return;
    // Focus moving between the controls of one field (radios, cells) is not leaving the field.
    if (e.relatedTarget instanceof Node && hit.field.contains(e.relatedTarget)) return;
    touched.add(hit.field);
    const when = mode(hit.form);
    if (when === "blur" || when === "blurThenChange") checkField(hit.form, hit.field, true);
  });
  listen("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const hit = fieldOfTarget(el);
    if (!el || !hit) return;
    if (el.closest("[data-nxt-clear]")) {
      writeField(hit.field, "");
      syncButtons(hit.field);
      focusTarget(hit.field)?.focus();
      onChange([tag(hit.form, hit.field)]);
    }
    const control = controlOf(hit.field);
    const toggle = el.closest<HTMLElement>("[data-nxt-toggle]");
    if (toggle && control instanceof HTMLInputElement) {
      const show = control.type === "password";
      control.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }
  });
  // Enter in a field must never send the values anywhere (no action, no query string).
  listen(
    "submit",
    (e) => {
      if (e.target instanceof Element && e.target.closest("form[data-nxt-form]"))
        e.preventDefault();
    },
    true
  );

  const write = (form: Element, field: Element, value: string): string | null => {
    if (controlsOf(field).length === 0 || readField(field) === value) return null;
    writeField(field, value);
    syncButtons(field);
    return tag(form, field);
  };
  const changed = (names: (string | null)[]) => {
    const real = names.filter((n): n is string => n !== null);
    if (real.length > 0) onChange(real);
    return real;
  };

  for (const form of forms()) fieldsOf(form).forEach(syncButtons);

  return {
    values: (includePasswords) => {
      const out: Record<string, Record<string, string>> = {};
      for (const form of forms()) {
        const values: Record<string, string> = {};
        for (const field of fieldsOf(form)) {
          if (controlsOf(field).length === 0) continue;
          if (field.matches("[data-nxt-secret]") && !includePasswords) continue;
          values[fieldNameOf(field)] = readField(field);
        }
        out[form.getAttribute("data-nxt-form") ?? ""] = values;
      }
      return out;
    },
    has: (form) => formNamed(form) !== null,
    validate: (name) => {
      const form = formNamed(name);
      const errors: FormCheck["errors"] = [];
      if (!form) return { valid: false, errors };
      for (const field of fieldsOf(form)) {
        touched.add(field);
        const message = checkField(form, field, true);
        if (message) errors.push({ field: fieldNameOf(field), message });
      }
      const first = errors[0];
      if (first) {
        const field = fieldsOf(form).find((f) => fieldNameOf(f) === first.field);
        (field ? focusTarget(field) : null)?.focus();
      }
      return { valid: errors.length === 0, errors };
    },
    set: (name, values) => {
      const form = formNamed(name);
      if (!form) return [];
      return changed(
        fieldsOf(form).map((field) => {
          const value = values[fieldNameOf(field)];
          return value === undefined ? null : write(form, field, value);
        })
      );
    },
    reset: (name) => {
      const form = formNamed(name);
      if (!form) return [];
      return changed(
        fieldsOf(form).map((field) => {
          touched.delete(field);
          showError(field, null, false);
          return write(form, field, defaultOf(field));
        })
      );
    },
    clear: (name) => {
      const form = formNamed(name);
      if (!form) return [];
      return changed(
        fieldsOf(form).map((field) => {
          touched.delete(field);
          showError(field, null, false);
          return write(form, field, "");
        })
      );
    },
    sync: (scope) => {
      scope.querySelectorAll("[data-nxt-field]").forEach(syncButtons);
      syncNumbers(scope);
      syncDates(scope);
      syncSelects(scope);
    },
    stop: () => stops.splice(0).forEach((stop) => stop())
  };
}
