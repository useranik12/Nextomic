import { z } from "zod";

// App state, constants and page state (docs/dynamic-data-and-actions.md section 5,
// docs/ui-reference.md 4.10). Values are stored as TEXT in the form the user typed them:
// numbers as digits, booleans as true/false, JSON and lists as JSON text. `checkStateValue`
// says whether a text fits the type.

export const STATE_TYPES = [
  "string",
  "integer",
  "float",
  "boolean",
  "datetime",
  "date",
  "time",
  "color",
  "url",
  "json",
  "enum"
] as const;
export const stateTypeSchema = z.enum(STATE_TYPES);
export type StateType = z.infer<typeof stateTypeSchema>;

export const STATE_TYPE_LABELS: Record<StateType, string> = {
  string: "String",
  integer: "Integer",
  float: "Float",
  boolean: "Boolean",
  datetime: "DateTime",
  date: "Date",
  time: "Time",
  color: "Color",
  url: "URL",
  json: "JSON",
  enum: "Enum"
};

export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Names that clash with JavaScript or with the dynamic data groups. */
export const RESERVED_STATE_NAMES: ReadonlySet<string> = new Set([
  "app",
  "const",
  "constants",
  "state",
  "page",
  "param",
  "params",
  "template",
  "user",
  "request",
  "now",
  "env",
  "item",
  "index",
  "parent",
  "query",
  "attr",
  "theme",
  "true",
  "false",
  "null",
  "undefined",
  "this",
  "new",
  "delete",
  "class",
  "function",
  "return",
  "var",
  "let",
  "constructor",
  "prototype",
  "__proto__"
]);

/** Why a name cannot be used, or null when it can. */
export function stateNameProblem(name: string, taken: readonly string[] = []): string | null {
  if (name.length === 0) return "Give the variable a name.";
  if (name.length > 64) return "Use at most 64 characters.";
  if (!IDENTIFIER_PATTERN.test(name))
    return "Use letters, digits and _, not starting with a digit.";
  if (RESERVED_STATE_NAMES.has(name.toLowerCase())) return `"${name}" is a reserved word.`;
  if (taken.includes(name)) return "That name is already used.";
  return null;
}

export const stateNameSchema = z.string().superRefine((name, ctx) => {
  const problem = stateNameProblem(name);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([^()]*\)$/i;

/** Why one value does not fit the type, or null when it does. */
function scalarProblem(type: StateType, value: unknown, options: readonly string[]): string | null {
  switch (type) {
    case "string":
      return typeof value === "string" ? null : "Expected text.";
    case "integer":
      return typeof value === "number" && Number.isInteger(value)
        ? null
        : "Expected a whole number.";
    case "float":
      return typeof value === "number" && Number.isFinite(value) ? null : "Expected a number.";
    case "boolean":
      return typeof value === "boolean" ? null : "Expected true or false.";
    case "datetime":
      return typeof value === "string" &&
        !Number.isNaN(Date.parse(value)) &&
        /\d{4}-\d{2}-\d{2}T/.test(value)
        ? null
        : "Expected a date and time like 2026-01-31T09:30.";
    case "date":
      return typeof value === "string" && DATE.test(value)
        ? null
        : "Expected a date like 2026-01-31.";
    case "time":
      return typeof value === "string" && TIME.test(value) ? null : "Expected a time like 09:30.";
    case "color":
      return typeof value === "string" && (HEX.test(value) || COLOR_FN.test(value))
        ? null
        : "Expected a color like #1a73e8 or rgb(26 115 232).";
    case "url":
      return typeof value === "string" && (value.startsWith("/") || /^https?:\/\/\S+$/i.test(value))
        ? null
        : "Expected an http(s) URL or a path starting with /.";
    case "json":
      return value !== null && typeof value === "object"
        ? null
        : "Expected a JSON object or array.";
    case "enum":
      return typeof value === "string" && options.includes(value)
        ? null
        : options.length === 0
          ? "Add options first."
          : `Expected one of: ${options.join(", ")}.`;
  }
}

/** Reads one typed value from the text the user wrote. */
function parseScalar(type: StateType, text: string): unknown {
  switch (type) {
    case "integer":
    case "float":
      return text.trim() === "" ? Number.NaN : Number(text);
    case "boolean":
      return text === "true" ? true : text === "false" ? false : text;
    case "json":
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    default:
      return text;
  }
}

/**
 * Why a value text does not fit the type, or null when it does. Empty text always fits: it means
 * "no value" (an empty list for lists). A list is a JSON array whose items each fit the type.
 */
export function checkStateValue(
  type: StateType,
  isList: boolean,
  text: string,
  options: readonly string[] = []
): string | null {
  if (text.trim() === "") return null;
  if (isList) {
    let items: unknown;
    try {
      items = JSON.parse(text);
    } catch {
      return 'A list is written as a JSON array, for example ["a", "b"].';
    }
    if (!Array.isArray(items)) return 'A list is written as a JSON array, for example ["a", "b"].';
    for (const [i, item] of items.entries()) {
      const problem = scalarProblem(type, item, options);
      if (problem) return `Item ${i + 1}: ${problem}`;
    }
    return null;
  }
  return scalarProblem(type, parseScalar(type, text), options);
}

const valueText = z.string().max(100_000).default("");
const enumOptions = z.array(z.string().trim().min(1).max(100)).max(100).default([]);

/** Fields every kind of state variable has. */
const variableShape = {
  id: z.string().min(1).max(64),
  name: stateNameSchema,
  type: stateTypeSchema.default("string"),
  isList: z.boolean().default(false),
  enumOptions,
  description: z.string().max(300).default("")
};

export const PERSIST_STORAGES = ["local", "cookie"] as const;

export const appStateVariableSchema = z
  .object({
    ...variableShape,
    defaultValue: valueText,
    /** Saved in the visitor's browser and restored on the next visit. */
    persist: z.boolean().default(false),
    storage: z.enum(PERSIST_STORAGES).default("local"),
    /** Persisted values are cleared on logout unless this is on. */
    keepAfterLogout: z.boolean().default(false)
  })
  .superRefine((v, ctx) => {
    const problem = checkStateValue(v.type, v.isList, v.defaultValue, v.enumOptions);
    if (problem) ctx.addIssue({ code: "custom", path: ["defaultValue"], message: problem });
  });
export type AppStateVariable = z.infer<typeof appStateVariableSchema>;

export const constantSchema = z
  .object({ ...variableShape, value: valueText })
  .superRefine((v, ctx) => {
    const problem = checkStateValue(v.type, v.isList, v.value, v.enumOptions);
    if (problem) ctx.addIssue({ code: "custom", path: ["value"], message: problem });
  });
export type Constant = z.infer<typeof constantSchema>;

function uniqueNames<T extends { name: string }>(list: T[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  list.forEach((v, i) => {
    if (seen.has(v.name))
      ctx.addIssue({ code: "custom", path: [i, "name"], message: `"${v.name}" is used twice.` });
    seen.add(v.name);
  });
}

export const appStateListSchema = z.array(appStateVariableSchema).max(500).superRefine(uniqueNames);
export const constantListSchema = z.array(constantSchema).max(500).superRefine(uniqueNames);

/** Cookie values travel with every request and are limited to about 4 KB each. */
export const COOKIE_VALUE_LIMIT = 4000;

/** A new app state variable with a free name. */
export function newAppStateVariable(id: string, taken: readonly string[]): AppStateVariable {
  return {
    id,
    name: freeName("variable", taken),
    type: "string",
    isList: false,
    enumOptions: [],
    description: "",
    defaultValue: "",
    persist: false,
    storage: "local",
    keepAfterLogout: false
  };
}

/** A new constant with a free name. */
export function newConstant(id: string, taken: readonly string[]): Constant {
  return {
    id,
    name: freeName("constant", taken),
    type: "string",
    isList: false,
    enumOptions: [],
    description: "",
    value: ""
  };
}

function freeName(prefix: string, taken: readonly string[]): string {
  for (let n = 1; ; n++) if (!taken.includes(`${prefix}_${n}`)) return `${prefix}_${n}`;
}

/** The value text a variable starts with after a type change: kept when it still fits. */
export function valueAfterTypeChange(
  text: string,
  type: StateType,
  isList: boolean,
  options: readonly string[]
): string {
  return checkStateValue(type, isList, text, options) === null ? text : "";
}
