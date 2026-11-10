import type { PageParam } from "../params";
import type { ParamField, Params } from "./fields";

// Navigate To and Show Toast pass one value per parameter of the page or template they target.
// A required parameter must get a value; a toast template must be able to show.

export interface TargetTemplate {
  params: readonly PageParam[];
  /** Set to Published (or scheduled). */
  published: boolean;
  /** Has at least one condition; without one it never shows. */
  hasConditions: boolean;
}

/** The parameters of every page and template, for checking flows that target them. */
export interface TargetParams {
  pages: Readonly<Record<string, readonly PageParam[]>>;
  templates: Readonly<Record<string, TargetTemplate>>;
}

export interface TargetProblems {
  errors: string[];
  warnings: string[];
}

const text = (value: Params[string] | undefined) => (typeof value === "string" ? value : "");

/** The value given for each parameter name. */
export function passedValues(value: Params[string] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(value)) return out;
  for (const row of value) if (row.name) out[row.name] = row.value ?? "";
  return out;
}

export function targetProblems(
  fields: readonly ParamField[],
  params: Params,
  targets: TargetParams
): TargetProblems {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const field of fields) {
    if (field.kind !== "targetParams" || !field.targetParam) continue;
    const source = fields.find((f) => f.key === field.targetParam);
    const id = text(params[field.targetParam]);
    if (!source || !id) continue;
    let defs: readonly PageParam[] | undefined;
    if (source.kind === "page") {
      defs = targets.pages[id];
      if (!defs) errors.push("The page no longer exists.");
    } else {
      const template = targets.templates[id];
      defs = template?.params;
      if (!template) errors.push("The template no longer exists.");
      else if (!template.published)
        warnings.push("The template is a draft, so it never shows. Set it to Published.");
      else if (!template.hasConditions)
        warnings.push(
          "The template has no conditions, so it never shows. Add Whole site to show it everywhere."
        );
    }
    const given = passedValues(params[field.key]);
    for (const def of defs ?? []) {
      if (def.required && (given[def.name] ?? "").trim() === "")
        errors.push(`${field.label}: ${def.name} is required.`);
    }
  }
  return { errors, warnings };
}
