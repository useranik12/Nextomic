import { walkElements, type ElementNode } from "./element";
import { patternProblem } from "./condition";
import type { DynamicContext } from "./dynamic-context";
import { fieldQueryProblem } from "./query";
import type { SupabaseStructure } from "./supabase";
import {
  isNumberField,
  numberFieldProblems,
  numberSpecOf,
  numberText,
  numberTypeOf
} from "./number-field";
import { pinLengthProblem } from "./pin";
import { checkStateValue, type StateType } from "./state";

// Forms (owner decisions 2026-11-16, elements.md "Forms"): a Form wrapper has a unique `name`, a
// `status` (an inactive form turns its actions and tags off) and `validateOn`. It has no action flow;
// work happens through Form actions in the Action flow editor. Fields are named inside their form
// and show up as {{ form.<formName>.<fieldName> }}. Forms never nest and never sit in a query loop.

export const FORM_TYPE = "form";
export const FORM_FIELD_TYPES = [
  "input",
  "checkbox",
  "radio",
  "checkboxGroup",
  "choiceChips",
  "pinInput",
  "counter",
  "rangeSlider"
] as const;

/** The data types an option value can be set to (the owner's FlutterFlow-style value type). */
export const OPTION_VALUE_TYPES = [
  "string",
  "int",
  "float",
  "boolean",
  "timestamptz",
  "color",
  "url"
] as const satisfies readonly StateType[];
export type OptionValueType = (typeof OPTION_VALUE_TYPES)[number];

/** Option elements sit directly inside these fields; a query loop on the field repeats them. */
export const OPTION_TYPE = "option";
export const OPTION_GROUP_TYPES = ["radio", "checkboxGroup", "choiceChips"] as const;
export const isOptionGroup = (node: ElementNode): boolean =>
  (OPTION_GROUP_TYPES as readonly string[]).includes(node.type);

/**
 * Options of a field are either fixed (written by hand, as many as wanted) or dynamic: the field
 * runs a query loop and keeps ONE option as the template, repeated once per row.
 */
export const OPTIONS_SOURCES = ["static", "dynamic"] as const;
export type OptionsSource = (typeof OPTIONS_SOURCES)[number];
export const optionsAreDynamic = (node: ElementNode): boolean =>
  isOptionGroup(node) && node.props.optionsSource === "dynamic";

/** The data type of a field's option values (text unless the field says otherwise). */
export const optionValueTypeOf = (group: ElementNode): OptionValueType =>
  OPTION_VALUE_TYPES.find((type) => type === group.props.valueType) ?? "string";

/** Why an option value does not fit the field's value type, or null when it does. */
export function optionValueProblem(type: OptionValueType, value: string): string | null {
  return type === "string" ? null : checkStateValue({ type, isList: false, ref: "" }, value);
}

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

/** How a field of this element holds its value (see `FIELD_VALUE_KINDS`). */
export function valueKindOf(node: ElementNode): FieldValueKind {
  if (node.type === "checkbox") return "check";
  return node.type === "checkboxGroup" || isMultiChips(node) ? "many" : "text";
}

/** Choice chips take several options unless `multiple` is switched off (a fixed choice, not data). */
export const isMultiChips = (node: ElementNode): boolean =>
  node.type === "choiceChips" && node.props.multiple !== false && node.props.multiple !== "false";

const isOn = (value: unknown): boolean => value === true || value === "true";

/** Options of a field that are chosen at the start (plain text values only). */
function startOptions(node: ElementNode): string[] {
  const chosen: string[] = [];
  for (const child of node.children) {
    if (child.type !== OPTION_TYPE || !isOn(child.props.selected)) continue;
    const value = propText(child, "value") || propText(child, "label");
    if (value) chosen.push(value);
  }
  return chosen;
}

/** The value a field starts with: plain text only (a dynamic default starts empty). */
export function startValueOf(node: ElementNode): string {
  if (node.type === "checkbox") return isOn(node.props.checked) ? "true" : "false";
  if (isOptionGroup(node)) {
    const chosen = startOptions(node);
    return valueKindOf(node) === "many"
      ? listText(chosen, optionValueTypeOf(node))
      : (chosen[0] ?? "");
  }
  if (node.props.type === "password") return "";
  if (isNumberField(node.type)) return numberText(numberSpecOf((key) => propText(node, key)).start);
  return typeof node.props.value === "string" ? node.props.value : "";
}

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
  walkElements(root, (node) => {
    if (isNumberField(node.type)) problems.push(...numberFieldProblems(node));
    if (node.type === "pinInput") {
      const unfit = pinLengthProblem(node);
      if (unfit) problems.push(unfit);
    }
    if (!isOptionGroup(node)) return;
    problems.push(...optionValueProblems(node));
    if (!optionsAreDynamic(node)) return;
    const name = propText(node, "name");
    if (!node.query?.enabled)
      problems.push(`"${name}" takes its options from a query, but no query is set up.`);
    else {
      const unfit = fieldQueryProblem(node.query);
      if (unfit) problems.push(`The query of "${name}" ${unfit}.`);
    }
    if (node.children.filter((child) => child.type === OPTION_TYPE).length !== 1)
      problems.push(
        `"${name}" takes its options from a query, so it needs exactly one option as the template.`
      );
  });
  return problems;
}

/** Why a node cannot move out of its parent to sit below it (the grandparent must accept it), or null. */
export function outdentProblem(root: ElementNode, id: string): string | null {
  const path = pathTo(root, id);
  const grand = path[path.length - 3];
  const node = path[path.length - 1];
  return grand && node ? formPlacementProblem(root, grand.id, node) : null;
}

/** Why this option cannot be removed, duplicated or moved, or null when it can. */
export function optionLockProblem(root: ElementNode, id: string): string | null {
  const path = pathTo(root, id);
  const node = path[path.length - 1];
  const parent = path[path.length - 2];
  if (node?.type === OPTION_TYPE && parent && optionsAreDynamic(parent))
    return "This option is the template of a field that takes its options from a query, so it stays. Switch the field to fixed options to change the options.";
  return null;
}

/** The text of a prop that holds plain text (no dynamic tags), or null when it holds tags. */
const plainText = (node: ElementNode, key: string): string | null => {
  const v = node.props[key];
  if (v === undefined) return "";
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
};

/**
 * One sentence for each option of this field whose written value does not fit the field's value
 * type. A value that holds dynamic tags is checked when the page is drawn, not here.
 */
export function optionValueProblems(group: ElementNode): string[] {
  const type = optionValueTypeOf(group);
  const out: string[] = [];
  for (const option of group.children) {
    if (option.type !== OPTION_TYPE) continue;
    const value = plainText(option, "value");
    const label = plainText(option, "label");
    const effective = value === "" ? label : value;
    if (effective === null || effective === "") continue;
    const problem = optionValueProblem(type, effective);
    if (problem)
      out.push(
        `Option "${effective}" of "${propText(group, "name")}" is not a valid ${type} value: ${problem}`
      );
  }
  return out;
}

// ---- validation ----

/**
 * How a field holds its value. `text` is one string (Input, Pin, Range, Date/time, Radio group).
 * `check` is "true" or "false". `many` is a list kept as JSON text (Checkbox group, Choice chips),
 * the way list variables are kept, so an option value may hold any character.
 */
export const FIELD_VALUE_KINDS = ["text", "check", "many"] as const;
export type FieldValueKind = (typeof FIELD_VALUE_KINDS)[number];

/** The items of a list value as text; anything that is not a JSON array gives []. */
export function parseList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => ["string", "number", "boolean"].includes(typeof item))
      .map((item) => String(item));
  } catch {
    return [];
  }
}

/**
 * Option values are typed by their field (`valueType`): a list of Int options holds numbers, a list
 * of Boolean options holds true and false, so `{{ form.x.y }}` gives real values.
 */
export function listText(items: readonly string[], type: OptionValueType = "string"): string {
  const typed = items.map((item): string | number | boolean => {
    if (type === "int" || type === "float") {
      const n = Number(item);
      return item.trim() !== "" && Number.isFinite(n) ? n : item;
    }
    return type === "boolean" && (item === "true" || item === "false") ? item === "true" : item;
  });
  return JSON.stringify(typed);
}

export interface FieldRules {
  /** Defaults to `text`. */
  kind?: FieldValueKind;
  /** `many` fields: the fewest and most items that may be chosen. */
  minSelected?: number | null;
  maxSelected?: number | null;
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

type MessageKey = "required" | "type" | "length" | "range" | "pattern" | "match" | "selection";

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
  match: "The values do not match.",
  selection: "Choose {range}."
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

function validateSelection(items: readonly string[], rules: FieldRules): string | null {
  if (items.length === 0) return rules.required ? message(rules, "required") : null;
  const least = rules.minSelected ?? null;
  const most = rules.maxSelected ?? null;
  if (least !== null && items.length < least)
    return message(rules, "selection", { range: `at least ${least}` });
  if (most !== null && items.length > most)
    return message(rules, "selection", { range: `at most ${most}` });
  return null;
}

/** The first problem with `value`, as the message to show, or null when it passes. */
export function validateValue(value: string, rules: FieldRules): string | null {
  if (rules.kind === "check")
    return value === "true" || !rules.required ? null : message(rules, "required");
  if (rules.kind === "many") return validateSelection(parseList(value), rules);
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
  const types = { ...dynamic.types };
  walkElements(tree, (node) => {
    if (node.type !== FORM_TYPE || !formIsActive(node) || !FORM_NAME_PATTERN.test(formName(node)))
      return;
    const values: Record<string, string> = {};
    walkElements(node, (child) => {
      if (child === node || !isFormField(child) || !FORM_NAME_PATTERN.test(fieldName(child)))
        return;
      const given = dynamic.forms[formName(node)]?.[fieldName(child)];
      values[fieldName(child)] =
        child.props.type === "password" ? "" : (given ?? startValueOf(child));
      if (isNumberField(child.type))
        types[`form.${formName(node)}.${fieldName(child)}`] = {
          type: numberTypeOf((key) => propText(child, key)),
          isList: false,
          ref: ""
        };
      if (isOptionGroup(child) || child.type === "checkbox") {
        const many = valueKindOf(child) === "many";
        const type = isOptionGroup(child) ? optionValueTypeOf(child) : "boolean";
        if (many || type !== "string")
          types[`form.${formName(node)}.${fieldName(child)}`] = { type, isList: many, ref: "" };
      }
    });
    forms[formName(node)] = values;
  });
  return { ...dynamic, forms, types };
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
  const path = pathTo(root, parentId);
  const parent = path[path.length - 1];
  if (subtree.type === OPTION_TYPE && !(parent && isOptionGroup(parent)))
    return "An option goes inside a Radio, Checkbox group or Choice chips.";
  if (parent && isOptionGroup(parent) && subtree.type !== OPTION_TYPE)
    return "Radio, Checkbox group and Choice chips can only hold options.";
  if (parent && optionsAreDynamic(parent))
    return "This field takes its options from a query and keeps one option as the template. Switch it to fixed options to add more.";
  if (!containsForm(subtree)) return null;
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
  "decLibrary",
  "incLibrary",
  ...INPUT_ICON_SLOTS.slice(1).map((slot) => slot.library)
];

/** Library keys the icons of this one element come from (SVG-code icons use none). */
export function iconLibrariesOf(node: ElementNode): string[] {
  const keys: unknown[] =
    node.type === "icon"
      ? [node.props.source === "svg" ? "" : node.props.library]
      : node.type === OPTION_TYPE
        ? [node.props.library]
        : node.type === "input"
          ? INPUT_ICON_SLOTS.map((slot) => node.props[slot.library])
          : node.type === "counter"
            ? [node.props.decLibrary, node.props.incLibrary]
            : [];
  return keys.filter((key): key is string => typeof key === "string" && key !== "");
}

/** Whether a column of this Nextomic type can fill option values of the field's data type. */
const columnFits = (column: StateType, wanted: OptionValueType): boolean =>
  wanted === "string" || column === wanted || (wanted === "float" && column === "int");

/**
 * Design-time check of a dynamic field: the template option's value reads a column of the
 * query's Supabase table, and that column's type must fit the field's value data type (an Int
 * field cannot take a text column). Null when it fits or cannot be told (no structure, a REST or
 * Other Loops source, a value that is not a plain loop-row column).
 */
export function optionColumnProblem(
  group: ElementNode,
  structure: SupabaseStructure | null
): string | null {
  const query = group.query;
  if (!structure || !query?.enabled || query.source !== "supabase" || !query.name) return null;
  const template = group.children.find((child) => child.type === OPTION_TYPE);
  if (!template) return null;
  // The value is what reaches the form; the label stands in while the value is empty.
  const written =
    JSON.stringify(template.props.value ?? "") + JSON.stringify(template.props.label ?? "");
  const name = query.name.replace(/[^A-Za-z0-9_]/g, "");
  const column = new RegExp(`%${name}\\.item\\.([A-Za-z_][A-Za-z0-9_]*)`).exec(written)?.[1];
  if (!column) return null;
  const table = structure.schemas
    .find((s) => s.schema === query.supabase.schema)
    ?.tables.find((t) => t.name === query.supabase.table);
  const found = table?.columns.find((c) => c.name === column);
  if (!found) return null;
  const wanted = optionValueTypeOf(group);
  if (found.isList) return `Column "${column}" is a list; an option takes one value.`;
  return columnFits(found.type, wanted)
    ? null
    : `Column "${column}" is ${found.type} (${found.pgType}), but this field expects ${wanted} values.`;
}
