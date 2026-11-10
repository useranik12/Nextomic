import { z } from "zod";
import type { TemplateType } from "../template";

// Parameter fields of actions, triggers and Action Block calls (docs/dynamic-data-and-actions.md
// section 8). A field describes one input of the Define Action panel; its value is stored as text
// that may mix static text and {{ tags }}, or as rows of such texts for list fields.

export const FIELD_KINDS = [
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "color",
  "element",
  "page",
  "appState",
  "pageState",
  "query",
  "supabaseTable",
  "supabaseColumn",
  "supabaseColumns",
  "restCall",
  "timeline",
  "theme",
  "rows",
  "template",
  "targetParams",
  "flow"
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export interface FieldOption {
  value: string;
  label: string;
}

export interface ParamField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Fields with the same group sit together under one collapsible heading in the panel. */
  group?: string;
  required?: boolean;
  /** Text stored when the action is added. */
  default?: string;
  help?: string;
  placeholder?: string;
  options?: readonly FieldOption[];
  /** `rows` only: the columns of one row. */
  columns?: readonly ParamField[];
  /** Shown only while another field of the same action holds one of these values. */
  showIf?: { key: string; in: readonly string[] };
  /** `element` only: element types that may be picked (all when absent). */
  elementTypes?: readonly string[];
  /** `page` only: the page being edited is left out of the list. */
  excludeCurrent?: boolean;
  /** `element` only: empty means the element that owns the flow. */
  selfWhenEmpty?: boolean;
  min?: number;
  max?: number;
  /** `supabaseColumn(s)` only: the key of the action's table field the columns come from. */
  tableParam?: string;
  /** `template` only: the template type that may be picked. */
  templateType?: TemplateType;
  /**
   * `targetParams` only: the key of the action's page or template field. One value per parameter
   * of the chosen page or template, stored as rows `{ name, value }`.
   */
  targetParam?: string;
}

/** Columns of a `targetParams` value: the parameter name and the value passed. */
export const TARGET_PARAM_COLUMNS: readonly ParamField[] = [
  { key: "name", label: "Name", kind: "text", required: true },
  { key: "value", label: "Value", kind: "text" }
];

/** The row columns of a `rows` or `targetParams` field; other fields have none. */
export const rowColumns = (field: ParamField): readonly ParamField[] =>
  field.kind === "targetParams" ? TARGET_PARAM_COLUMNS : (field.columns ?? []);

/** Fields stored as a list of rows. */
export const isRowsField = (field: Pick<ParamField, "kind">): boolean =>
  field.kind === "rows" || field.kind === "targetParams";

/**
 * Fields that name a structure item (an element, a page, a variable, a saved query or call) take
 * no dynamic data, so flows can be checked when they are saved. The values they lead to do.
 */
export const UNBINDABLE_FIELD_REASONS: Partial<Record<FieldKind, string>> = {
  element: "Picks an element of this page so the flow can be checked when it is saved.",
  page: "Picks a page so its route parameters can be checked; use Launch URL for an address built from data.",
  appState: "Names the variable to change; the new value takes dynamic data.",
  pageState: "Names the variable to change; the new value takes dynamic data.",
  query: "Picks a query loop of this page; its parameters take dynamic data.",
  supabaseTable:
    "Picks a table from the saved Supabase structure; filters and values take dynamic data.",
  supabaseColumn: "Picks a column of the chosen table so the flow can be checked when it is saved.",
  supabaseColumns: "Picks columns of the chosen table so the flow can be checked when it is saved.",
  restCall: "Picks a saved API Data call; its variables take dynamic data.",
  timeline: "Picks a saved GSAP timeline.",
  rows: "A list of rows; each column says whether it takes dynamic data.",
  template: "Picks a template so its parameters can be checked when the flow is saved.",
  targetParams:
    "One value per parameter of the chosen page or template; each value takes dynamic data.",
  flow: "A nested action flow built in the editor, not a value."
};

export const fieldBindable = (field: Pick<ParamField, "kind">): boolean =>
  UNBINDABLE_FIELD_REASONS[field.kind] === undefined;

export const PARAM_TEXT_MAX = 20_000;
export const PARAM_ROWS_MAX = 200;

export const paramRowSchema = z.record(z.string().max(64), z.string().max(PARAM_TEXT_MAX));
export type ParamRow = z.infer<typeof paramRowSchema>;

export const paramValueSchema = z.union([
  z.string().max(PARAM_TEXT_MAX),
  z.array(paramRowSchema).max(PARAM_ROWS_MAX)
]);
export type ParamValue = z.infer<typeof paramValueSchema>;

export const paramsSchema = z.record(z.string().max(64), paramValueSchema).default({});
export type Params = Record<string, ParamValue>;

const textOf = (value: ParamValue | undefined): string => (typeof value === "string" ? value : "");

/** True when the field is on screen for these params; an untouched source field reads as its default. */
export function fieldShown(
  field: ParamField,
  params: Params,
  fields: readonly ParamField[]
): boolean {
  if (!field.showIf) return true;
  const { key } = field.showIf;
  const current = textOf(params[key]) || fields.find((f) => f.key === key)?.default || "";
  return field.showIf.in.includes(current);
}

function valueEmpty(field: ParamField, value: ParamValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (field.kind !== "rows") return true;
  const required = (field.columns ?? []).filter((c) => c.required);
  const filled = value.filter((row) => required.every((c) => (row[c.key] ?? "").trim() !== ""));
  return filled.length === 0;
}

/** Labels of required fields that are on screen and empty. */
export function missingRequired(fields: readonly ParamField[], params: Params): string[] {
  return fields
    .filter((f) => f.required && fieldShown(f, params, fields) && valueEmpty(f, params[f.key]))
    .map((f) => f.label);
}

/** Rows whose required columns are partly empty: "Filters row 2: Column". */
export function incompleteRows(fields: readonly ParamField[], params: Params): string[] {
  const out: string[] = [];
  for (const field of fields) {
    const value = params[field.key];
    if (field.kind !== "rows" || !Array.isArray(value) || !fieldShown(field, params, fields))
      continue;
    // targetParams rows are checked against the page or template (target-check.ts).
    value.forEach((row, i) => {
      const touched = Object.values(row).some((v) => v.trim() !== "");
      if (!touched) return;
      for (const column of field.columns ?? []) {
        if (column.required && (row[column.key] ?? "").trim() === "") {
          out.push(`${field.label} row ${i + 1}: ${column.label}`);
        }
      }
    });
  }
  return out;
}

/** Static select values that are not one of the options (a {{ tag }} is checked at run time). */
export function invalidOptions(fields: readonly ParamField[], params: Params): string[] {
  return fields
    .filter((f) => f.kind === "select" && f.options && fieldShown(f, params, fields))
    .filter((f) => {
      const value = textOf(params[f.key]).trim();
      if (value === "" || value.includes("{{")) return false;
      return !(f.options ?? []).some((o) => o.value === value);
    })
    .map((f) => f.label);
}

/** The params a newly added action starts with: every field's default. */
export function defaultParams(fields: readonly ParamField[]): Params {
  const params: Params = {};
  for (const field of fields) {
    if (isRowsField(field)) params[field.key] = [];
    else if (field.default !== undefined) params[field.key] = field.default;
  }
  return params;
}
