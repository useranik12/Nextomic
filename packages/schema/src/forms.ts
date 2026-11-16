import { walkElements, type ElementNode } from "./element";
import { patternProblem } from "./condition";
import type { DynamicContext } from "./dynamic-context";

// Forms (owner decisions 2026-11-16, elements.md "Forms"): a Form wrapper has a unique `name`, a
// `status` (an inactive form turns its actions and tags off) and `validateOn`. It has no action flow;
// work happens through Form actions in the Action flow editor. Fields are named inside their form
// and show up as {{ form.<formName>.<fieldName> }}. Forms never nest and never sit in a query loop.

export const FORM_TYPE = "form";
export const FORM_FIELD_TYPES = ["input"] as const;

/** Names are identifiers so the dotted tag path never needs quoting. */
export const FORM_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

export const FORM_STATUSES = ["active", "inactive"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const VALIDATE_ON = ["action", "change", "blur", "blurThenChange"] as const;
export type ValidateOn = (typeof VALIDATE_ON)[number];
export const VALIDATE_ON_LABELS: Record<ValidateOn, string> = {
  action: "When validated by an action",
  change: "On change",
  blur: "On blur",
  blurThenChange: "On blur, then on change"
};

export const INPUT_TYPES = [
  "text",
  "email",
  "number",
  "password",
  "tel",
  "url",
  "search",
  "textarea"
] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const isFormField = (node: ElementNode): boolean =>
  (FORM_FIELD_TYPES as readonly string[]).includes(node.type);

const propText = (node: ElementNode, key: string): string => {
  const v = node.props[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
};

export const formName = (node: ElementNode): string => propText(node, "name");
export const fieldName = (node: ElementNode): string => propText(node, "name");
export const formIsActive = (node: ElementNode): boolean => node.props.status !== "inactive";

export interface FormInfo {
  id: string;
  name: string;
  active: boolean;
  fields: { id: string; name: string; type: string }[];
}

/** The forms of a tree, in document order, with their named fields. */
export function formsOf(root: ElementNode): FormInfo[] {
  const forms: FormInfo[] = [];
  walkElements(root, (node) => {
    if (node.type !== FORM_TYPE) return;
    const fields: FormInfo["fields"] = [];
    walkElements(node, (child) => {
      if (child !== node && isFormField(child) && fieldName(child))
        fields.push({
          id: child.id,
          name: fieldName(child),
          type: child.type === "input" ? propText(child, "type") || "text" : child.type
        });
    });
    forms.push({ id: node.id, name: formName(node), active: formIsActive(node), fields });
  });
  return forms;
}

/** Active forms that have a valid name: the ones whose actions and tags are available. */
export const activeForms = (root: ElementNode): FormInfo[] =>
  formsOf(root).filter((f) => f.active && FORM_NAME_PATTERN.test(f.name));

/** Whether any tree holds an active, named form. */
export const hasActiveForm = (...roots: ElementNode[]): boolean =>
  roots.some((root) => activeForms(root).length > 0);

/** `base`, or `base2`, `base3` ... when taken (case-insensitive). */
export function freeFormName(taken: Iterable<string>, base: string): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) if (!used.has(`${base}${n}`.toLowerCase())) return `${base}${n}`;
}

/** Problems that make a tree unsaveable or a form unusable; one sentence each. */
export function formProblems(root: ElementNode): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const visit = (node: ElementNode, inForm: boolean, inLoop: boolean) => {
    const loop = inLoop || Boolean(node.query?.enabled);
    if (node.type === FORM_TYPE) {
      const name = formName(node);
      if (inForm) problems.push("A form cannot sit inside another form.");
      if (loop) problems.push(`Form "${name}" cannot sit inside a query loop.`);
      if (!FORM_NAME_PATTERN.test(name))
        problems.push(
          "A form name starts with a letter and uses only letters, digits and underscores."
        );
      else if (seen.has(name.toLowerCase())) problems.push(`Two forms are named "${name}".`);
      else seen.add(name.toLowerCase());
      const fields = new Set<string>();
      walkElements(node, (child) => {
        if (child === node || !isFormField(child)) return;
        const n = fieldName(child);
        if (!FORM_NAME_PATTERN.test(n))
          problems.push(`A field in form "${name}" needs a name (letters, digits, underscores).`);
        else if (fields.has(n.toLowerCase()))
          problems.push(`Form "${name}" has two fields named "${n}".`);
        else fields.add(n.toLowerCase());
      });
    }
    node.children.forEach((child) => visit(child, inForm || node.type === FORM_TYPE, loop));
  };
  visit(root, false, false);
  return problems;
}

// ---- validation ----

export interface FieldRules {
  type: InputType;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  /** A regular expression; ignored when it fails `patternProblem`. */
  pattern: string;
  /** The current value of the field named in `matchField` (empty when there is none). */
  matchValue: string | null;
  messages: Partial<Record<MessageKey, string>>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const urlOk = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

type MessageKey = "required" | "type" | "length" | "range" | "pattern" | "match";

/**
 * The messages a field shows when it has no message of its own. {type}, {length} and {range} are
 * replaced by the words for the failed check ("a valid email address", "at least 3", "5 or more").
 */
export const DEFAULT_MESSAGES: Readonly<Record<MessageKey, string>> = {
  required: "This field is required.",
  type: "Enter {type}.",
  length: "Use {length} characters.",
  range: "Enter {range}.",
  pattern: "This does not match the expected format.",
  match: "The values do not match."
};

const TYPE_WORDS: Partial<Record<InputType, string>> = {
  email: "a valid email address",
  url: "a valid web address",
  number: "a number"
};

/** The message for a failed check: the field's own text, else the default, with {words} filled in. */
function message(rules: FieldRules, key: MessageKey, words: Record<string, string> = {}): string {
  const text = rules.messages[key] || DEFAULT_MESSAGES[key];
  return text.replace(/{(type|length|range)}/g, (all, name: string) => words[name] ?? all);
}

/** The first problem with `value`, as the message to show, or null when it passes. */
export function validateValue(value: string, rules: FieldRules): string | null {
  if (value.trim() === "") return rules.required ? message(rules, "required") : null;
  const type = { type: TYPE_WORDS[rules.type] ?? "a valid value" };
  if (rules.type === "email" && !EMAIL.test(value)) return message(rules, "type", type);
  if (rules.type === "url" && !urlOk(value)) return message(rules, "type", type);
  if (rules.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return message(rules, "type", type);
    if (rules.min !== null && n < rules.min)
      return message(rules, "range", { range: `${rules.min} or more` });
    if (rules.max !== null && n > rules.max)
      return message(rules, "range", { range: `${rules.max} or less` });
  }
  if (rules.minLength !== null && value.length < rules.minLength)
    return message(rules, "length", { length: `at least ${rules.minLength}` });
  if (rules.maxLength !== null && value.length > rules.maxLength)
    return message(rules, "length", { length: `at most ${rules.maxLength}` });
  if (
    rules.pattern &&
    !patternProblem(rules.pattern) &&
    !new RegExp(rules.pattern, "u").test(value)
  )
    return message(rules, "pattern");
  if (rules.matchValue !== null && value !== rules.matchValue) return message(rules, "match");
  return null;
}

// ---- values in dynamic data ----

/**
 * The context with every named field of an active form in `tree` present under
 * `forms.<form>.<field>`: the visitor's value when `dynamic.forms` has one, else the field's
 * starting value (plain text only; a dynamic default starts empty). Fields of the tree decide what
 * exists, so a request cannot add forms or fields. Password fields always start and stay empty.
 */
export function withFormDefaults(dynamic: DynamicContext, tree: ElementNode): DynamicContext {
  const forms: Record<string, Record<string, string>> = {};
  walkElements(tree, (node) => {
    if (node.type !== FORM_TYPE || !formIsActive(node) || !FORM_NAME_PATTERN.test(formName(node)))
      return;
    const values: Record<string, string> = {};
    walkElements(node, (child) => {
      if (child === node || !isFormField(child) || !FORM_NAME_PATTERN.test(fieldName(child)))
        return;
      const start = typeof child.props.value === "string" ? child.props.value : "";
      const given = dynamic.forms[formName(node)]?.[fieldName(child)];
      values[fieldName(child)] = child.props.type === "password" ? "" : (given ?? start);
    });
    forms[formName(node)] = values;
  });
  return { ...dynamic, forms };
}

// ---- placing forms in a tree ----

/** The elements from the root down to `id` (inclusive), or [] when `id` is not in the tree. */
function pathTo(root: ElementNode, id: string): ElementNode[] {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const below = pathTo(child, id);
    if (below.length > 0) return [root, ...below];
  }
  return [];
}

const containsForm = (node: ElementNode): boolean => {
  let found = false;
  walkElements(node, (n) => {
    if (n.type === FORM_TYPE) found = true;
  });
  return found;
};

/** Why `subtree` (a new or moved element) cannot go under `parentId`, or null when it can. */
export function formPlacementProblem(
  root: ElementNode,
  parentId: string,
  subtree: ElementNode
): string | null {
  if (!containsForm(subtree)) return null;
  const path = pathTo(root, parentId);
  if (path.some((n) => n.type === FORM_TYPE)) return "A form cannot sit inside another form.";
  if (path.some((n) => n.query?.enabled)) return "A form cannot sit inside a query loop.";
  return null;
}

/**
 * Gives the forms and fields of `subtree` names that are free where it is going: form names are
 * unique on the page, field names unique inside their form. `subtree` may already be in `root`
 * (a duplicate); its own elements are then left out of the names taken. Changes `subtree`.
 */
export function uniquifyFormNames(root: ElementNode, parentId: string, subtree: ElementNode): void {
  const own = new Set<string>();
  walkElements(subtree, (n) => own.add(n.id));
  const takenForms: string[] = [];
  walkElements(root, (n) => {
    if (!own.has(n.id) && n.type === FORM_TYPE) takenForms.push(formName(n));
  });
  const fieldsOfForm = (form: ElementNode, skipOwn: boolean): string[] => {
    const names: string[] = [];
    walkElements(form, (n) => {
      if (n !== form && isFormField(n) && !(skipOwn && own.has(n.id))) names.push(fieldName(n));
    });
    return names;
  };
  const rename = (node: ElementNode, taken: string[], base: string, key: "name") => {
    const next = freeFormName(
      taken,
      FORM_NAME_PATTERN.test(propText(node, key)) ? propText(node, key) : base
    );
    node.props[key] = next;
    taken.push(next);
  };
  // Forms inside the subtree, then fields: each form numbers its own fields.
  const visit = (node: ElementNode) => {
    if (node.type === FORM_TYPE) {
      rename(node, takenForms, "form", "name");
      const fields: string[] = [];
      walkElements(node, (n) => {
        if (n !== node && isFormField(n)) rename(n, fields, "field", "name");
      });
      return;
    }
    node.children.forEach(visit);
  };
  visit(subtree);
  // A field placed (not inside a form of its own) into an existing form joins that form's names.
  const enclosing = [...pathTo(root, parentId)].reverse().find((n) => n.type === FORM_TYPE);
  if (!enclosing) return;
  const taken = fieldsOfForm(enclosing, true);
  const loose = (node: ElementNode) => {
    if (node.type === FORM_TYPE) return;
    if (isFormField(node)) rename(node, taken, "field", "name");
    node.children.forEach(loose);
  };
  loose(subtree);
}

// ---- icons of elements ----

/** The props of an Input that hold an icon library key, each beside the icon name it draws. */
export const INPUT_ICON_SLOTS = [
  { library: "library", name: "icon" },
  { library: "clearLibrary", name: "clearIcon" },
  { library: "showLibrary", name: "showIcon" },
  { library: "hideLibrary", name: "hideIcon" }
] as const;

/** The prop names that can hold an icon library key (Icon element and Input slots). */
export const ICON_LIBRARY_PROPS: readonly string[] = [
  "library",
  ...INPUT_ICON_SLOTS.slice(1).map((slot) => slot.library)
];

/** Library keys the icons of this one element come from (SVG-code icons use none). */
export function iconLibrariesOf(node: ElementNode): string[] {
  const keys: unknown[] =
    node.type === "icon"
      ? [node.props.source === "svg" ? "" : node.props.library]
      : isFormField(node)
        ? INPUT_ICON_SLOTS.map((slot) => node.props[slot.library])
        : [];
  return keys.filter((key): key is string => typeof key === "string" && key !== "");
}
