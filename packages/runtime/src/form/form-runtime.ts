import { validateValue, type FieldRules, type InputType, INPUT_TYPES } from "@nextomic/schema";

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

type Control = HTMLInputElement | HTMLTextAreaElement;

const FORM = "form[data-nxt-form]:not([data-nxt-inactive])";
const NUMBER = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const controlOf = (field: Element): Control | null =>
  field.querySelector<Control>("[data-nxt-control]");
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
    required: raw.required === true,
    minLength: NUMBER(raw.minLength),
    maxLength: NUMBER(raw.maxLength),
    min: NUMBER(raw.min),
    max: NUMBER(raw.max),
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

  const forms = () => [...root.querySelectorAll<HTMLFormElement>(FORM)];
  const formNamed = (name: string) =>
    forms().find((f) => f.getAttribute("data-nxt-form") === name) ?? null;
  const tag = (form: Element, field: Element) =>
    `form.${form.getAttribute("data-nxt-form") ?? ""}.${fieldNameOf(field)}`;

  const showError = (field: Element, message: string | null) => {
    const error = field.querySelector("[data-nxt-error]");
    if (error) {
      error.textContent = message ?? "";
      error.toggleAttribute("hidden", !message);
    }
    const control = controlOf(field);
    if (control) control.setAttribute("aria-invalid", message ? "true" : "false");
    field.toggleAttribute("data-invalid", Boolean(message));
  };

  const checkField = (form: Element, field: Element, show: boolean): string | null => {
    const control = controlOf(field);
    if (!control) return null;
    const { matchField, ...rest } = parseRules(field);
    const other = matchField
      ? fieldsOf(form).find((f) => fieldNameOf(f) === matchField)
      : undefined;
    const matchValue = other ? (controlOf(other)?.value ?? "") : null;
    const message = validateValue(control.value, { ...rest, matchValue });
    if (show) showError(field, message);
    return message;
  };

  const syncButtons = (field: Element) => {
    const control = controlOf(field);
    const clear = field.querySelector<HTMLElement>("[data-nxt-clear]");
    if (clear && control) clear.toggleAttribute("hidden", control.value === "");
  };

  const fieldOfTarget = (target: EventTarget | null) => {
    const el = target instanceof Element ? target : null;
    const field = el?.closest("[data-nxt-field]") ?? null;
    const form = field?.closest(FORM) ?? null;
    return field && form ? { field, form } : null;
  };
  const mode = (form: Element) => form.getAttribute("data-nxt-validate-on") ?? "blurThenChange";

  listen("input", (e) => {
    const hit = fieldOfTarget(e.target);
    if (!hit || e.target !== controlOf(hit.field)) return;
    syncButtons(hit.field);
    const when = mode(hit.form);
    if (when === "change" || (when === "blurThenChange" && touched.has(hit.field)))
      checkField(hit.form, hit.field, true);
    onChange([tag(hit.form, hit.field)]);
  });
  listen("focusout", (e) => {
    const hit = fieldOfTarget(e.target);
    if (!hit || e.target !== controlOf(hit.field)) return;
    touched.add(hit.field);
    const when = mode(hit.form);
    if (when === "blur" || when === "blurThenChange") checkField(hit.form, hit.field, true);
  });
  listen("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const hit = fieldOfTarget(el);
    if (!el || !hit) return;
    const control = controlOf(hit.field);
    if (!control) return;
    if (el.closest("[data-nxt-clear]")) {
      control.value = "";
      syncButtons(hit.field);
      control.focus();
      onChange([tag(hit.form, hit.field)]);
    }
    const toggle = el.closest<HTMLElement>("[data-nxt-toggle]");
    if (toggle && control instanceof HTMLInputElement) {
      const show = control.type === "password";
      control.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      toggle.textContent = show ? "Hide" : "Show";
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
    const control = controlOf(field);
    if (!control || control.value === value) return null;
    control.value = value;
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
          const control = controlOf(field);
          if (!control) continue;
          const secret = control instanceof HTMLInputElement && field.matches("[data-nxt-secret]");
          if (secret && !includePasswords) continue;
          values[fieldNameOf(field)] = control.value;
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
        (field ? controlOf(field) : null)?.focus();
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
          showError(field, null);
          return write(form, field, controlOf(field)?.defaultValue ?? "");
        })
      );
    },
    clear: (name) => {
      const form = formNamed(name);
      if (!form) return [];
      return changed(
        fieldsOf(form).map((field) => {
          touched.delete(field);
          showError(field, null);
          return write(form, field, "");
        })
      );
    },
    sync: (scope) => scope.querySelectorAll("[data-nxt-field]").forEach(syncButtons),
    stop: () => stops.splice(0).forEach((stop) => stop())
  };
}
