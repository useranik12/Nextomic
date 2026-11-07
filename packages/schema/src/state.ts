import { z } from "zod";

// Data types, app state, constants and page state (docs/dynamic-data-and-actions.md section 5,
// docs/ui-reference.md 4.10 and 4.14). Values are stored as TEXT in the form the user typed them:
// numbers as digits, booleans as true/false, JSON, data type values, rows and lists as JSON text.
// `checkStateValue` says whether a text fits a type.

export const STATE_TYPES = [
  "string",
  "int",
  "float",
  "boolean",
  "json",
  "timestamptz",
  "color",
  "url",
  "enum",
  "dataType",
  "supabaseRow"
] as const;
export type StateType = (typeof STATE_TYPES)[number];

/** Types a custom data type's fields can have (everything except a Supabase row). */
export const FIELD_TYPES = [
  "string",
  "int",
  "float",
  "boolean",
  "json",
  "timestamptz",
  "color",
  "url",
  "enum",
  "dataType"
] as const satisfies readonly StateType[];

/** Types a page parameter (a value from the address) can have. */
export const PARAM_TYPES = ["string", "int", "float", "boolean", "timestamptz"] as const;

export const STATE_TYPE_LABELS: Record<StateType, string> = {
  string: "String",
  int: "Int",
  float: "Float",
  boolean: "Boolean",
  json: "JSON",
  timestamptz: "Timestamptz",
  color: "Color",
  url: "URL",
  enum: "Enum",
  dataType: "Data Type",
  supabaseRow: "Supabase Row"
};

/** Types that need a reference: the enum, the data type or the Supabase table they use. */
export const REF_TYPES: ReadonlySet<StateType> = new Set(["enum", "dataType", "supabaseRow"]);

// Types of the first State build read as their replacements.
// Number became Int and Float; an old Number reads as Float, which accepts every number it held.
const LEGACY_TYPES: Record<string, StateType> = {
  number: "float",
  integer: "int",
  datetime: "timestamptz",
  date: "timestamptz",
  time: "timestamptz"
};

export const stateTypeSchema = z.preprocess(
  (raw) => (typeof raw === "string" ? (LEGACY_TYPES[raw] ?? raw) : raw),
  z.enum(STATE_TYPES)
);
export const fieldTypeSchema = z.preprocess(
  (raw) => (typeof raw === "string" ? (LEGACY_TYPES[raw] ?? raw) : raw),
  z.enum(FIELD_TYPES)
);

export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Names that clash with JavaScript or with the dynamic data groups. */
export const RESERVED_STATE_NAMES: ReadonlySet<string> = new Set([
  "app",
  "nextomic",
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
  "today",
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
  if (name.length === 0) return "Give it a name.";
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

function uniqueNames<T extends { name: string }>(list: T[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  list.forEach((v, i) => {
    if (seen.has(v.name))
      ctx.addIssue({ code: "custom", path: [i, "name"], message: `"${v.name}" is used twice.` });
    seen.add(v.name);
  });
}

// ---------------------------------------------------------------- enums and custom data types

export const appEnumSchema = z.object({
  id: z.string().min(1).max(64),
  name: stateNameSchema,
  description: z.string().max(300).default(""),
  values: z
    .array(z.string().trim().min(1).max(100))
    .max(200)
    .default([])
    .refine((values) => new Set(values).size === values.length, "Each value can appear once.")
});
export type AppEnum = z.infer<typeof appEnumSchema>;

export const dataTypeFieldSchema = z.object({
  id: z.string().min(1).max(64),
  name: stateNameSchema,
  type: fieldTypeSchema.default("string"),
  isList: z.boolean().default(false),
  /** The enum or data type id, for those field types. */
  ref: z.string().max(200).default(""),
  description: z.string().max(300).default("")
});
export type DataTypeField = z.infer<typeof dataTypeFieldSchema>;

export const dataTypeSchema = z.object({
  id: z.string().min(1).max(64),
  name: stateNameSchema,
  description: z.string().max(300).default(""),
  fields: z.array(dataTypeFieldSchema).max(200).default([]).superRefine(uniqueNames)
});
export type DataType = z.infer<typeof dataTypeSchema>;

export const appEnumListSchema = z.array(appEnumSchema).max(500).superRefine(uniqueNames);
export const dataTypeListSchema = z.array(dataTypeSchema).max(500).superRefine(uniqueNames);

/** What `enum` and `dataType` references point at. Without it, references are not checked. */
export interface TypeRegistry {
  enums: readonly AppEnum[];
  dataTypes: readonly DataType[];
}

/** A type with its list flag and reference: enough to check or describe a value. */
export interface TypeSpec {
  type: StateType;
  isList: boolean;
  ref: string;
}

/** "String", "Int[]", "Enum Size", "Data Type Address[]" for display. */
export function describeType(spec: TypeSpec, registry?: TypeRegistry): string {
  const refName =
    spec.type === "enum"
      ? registry?.enums.find((e) => e.id === spec.ref)?.name
      : spec.type === "dataType"
        ? registry?.dataTypes.find((d) => d.id === spec.ref)?.name
        : spec.type === "supabaseRow"
          ? spec.ref
          : undefined;
  const base = refName
    ? `${STATE_TYPE_LABELS[spec.type]} ${refName}`
    : STATE_TYPE_LABELS[spec.type];
  return spec.isList ? `${base}[]` : base;
}

// ---------------------------------------------------------------- value checks

/** Postgres timestamptz or timestamp text, or ISO 8601: a date, a time, maybe seconds and a zone. */
export const TIMESTAMP_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]([01]\d)(:?[0-5]\d)?)?$/i;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([^()]*\)$/i;
const MAX_DEPTH = 6;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Why one (already parsed) value does not fit the type, or null when it does. */
function valueProblem(
  spec: TypeSpec,
  value: unknown,
  registry: TypeRegistry | undefined,
  depth: number
): string | null {
  if (spec.isList) {
    if (!Array.isArray(value)) return "Expected a list (a JSON array).";
    for (const [i, item] of value.entries()) {
      const problem = valueProblem({ ...spec, isList: false }, item, registry, depth);
      if (problem) return `Item ${i + 1}: ${problem}`;
    }
    return null;
  }
  if (value === null) return null;
  switch (spec.type) {
    case "string":
      return typeof value === "string" ? null : "Expected text.";
    case "int":
      return typeof value === "number" && Number.isInteger(value)
        ? null
        : "Expected a whole number.";
    case "float":
      return typeof value === "number" && Number.isFinite(value) ? null : "Expected a number.";
    case "boolean":
      return typeof value === "boolean" ? null : "Expected true or false.";
    case "json":
      return typeof value === "object" ? null : "Expected a JSON object or array.";
    case "timestamptz":
      return typeof value === "string" && TIMESTAMP_PATTERN.test(value)
        ? null
        : "Expected a timestamp like 2026-01-31T09:30:00Z.";
    case "color":
      return typeof value === "string" && (HEX.test(value) || COLOR_FN.test(value))
        ? null
        : "Expected a color like #1a73e8 or rgb(26 115 232).";
    case "url":
      return typeof value === "string" && (value.startsWith("/") || /^https?:\/\/\S+$/i.test(value))
        ? null
        : "Expected an http(s) URL or a path starting with /.";
    case "enum": {
      if (typeof value !== "string") return "Expected one of the enum values.";
      if (!registry) return null;
      const found = registry.enums.find((e) => e.id === spec.ref);
      if (!found) return "Choose an enum.";
      return found.values.includes(value) ? null : `Expected one of: ${found.values.join(", ")}.`;
    }
    case "dataType": {
      if (!isObject(value)) return "Expected an object with the data type's fields.";
      if (!registry) return null;
      const found = registry.dataTypes.find((d) => d.id === spec.ref);
      if (!found) return "Choose a data type.";
      if (depth >= MAX_DEPTH) return null;
      for (const [key, fieldValue] of Object.entries(value)) {
        const field = found.fields.find((f) => f.name === key);
        if (!field) return `${found.name} has no field "${key}".`;
        const problem = valueProblem(field, fieldValue, registry, depth + 1);
        if (problem) return `${key}: ${problem}`;
      }
      return null;
    }
    case "supabaseRow":
      return isObject(value) ? null : "Expected a row (a JSON object).";
  }
}

/** Reads the typed value from the text the user wrote; undefined when it cannot be read. */
export function parseStateValue(spec: Pick<TypeSpec, "type" | "isList">, text: string): unknown {
  const trimmed = text.trim();
  const json = () => {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return undefined;
    }
  };
  if (spec.isList) return json();
  switch (spec.type) {
    case "int":
    case "float":
      return trimmed === "" || Number.isNaN(Number(trimmed)) ? undefined : Number(trimmed);
    case "boolean":
      return trimmed === "true" ? true : trimmed === "false" ? false : text;
    case "json":
    case "dataType":
    case "supabaseRow":
      return json();
    default:
      return text;
  }
}

/**
 * Why a value text does not fit the type, or null when it does. Empty text always fits: it means
 * "no value". Lists, JSON, data type values and rows are JSON text.
 */
export function checkStateValue(
  spec: TypeSpec,
  text: string,
  registry?: TypeRegistry
): string | null {
  if (text.trim() === "") return null;
  const value = parseStateValue(spec, text);
  if (value === undefined)
    return spec.isList
      ? 'A list is written as a JSON array, for example ["a", "b"].'
      : spec.type === "int"
        ? "Expected a whole number."
        : spec.type === "float"
          ? "Expected a number."
          : "That is not valid JSON.";
  return valueProblem(spec, value, registry, 0);
}

/** The value text a variable keeps after a type change: kept when it still fits. */
export function valueAfterTypeChange(
  text: string,
  spec: TypeSpec,
  registry?: TypeRegistry
): string {
  return checkStateValue(spec, text, registry) === null ? text : "";
}

// ---------------------------------------------------------------- variables

const valueText = z.string().max(100_000).default("");

/** Fields every kind of state variable has. */
const variableShape = {
  id: z.string().min(1).max(64),
  name: stateNameSchema,
  type: stateTypeSchema.default("string"),
  isList: z.boolean().default(false),
  /** The enum id, data type id or Supabase table, for those types. */
  ref: z.string().max(200).default(""),
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
    const problem = checkStateValue(v, v.defaultValue);
    if (problem) ctx.addIssue({ code: "custom", path: ["defaultValue"], message: problem });
  });
export type AppStateVariable = z.infer<typeof appStateVariableSchema>;

export const constantSchema = z
  .object({ ...variableShape, value: valueText })
  .superRefine((v, ctx) => {
    const problem = checkStateValue(v, v.value);
    if (problem) ctx.addIssue({ code: "custom", path: ["value"], message: problem });
  });
export type Constant = z.infer<typeof constantSchema>;

export const appStateListSchema = z.array(appStateVariableSchema).max(500).superRefine(uniqueNames);
export const constantListSchema = z.array(constantSchema).max(500).superRefine(uniqueNames);

/** Cookie values travel with every request and are limited to about 4 KB each. */
export const COOKIE_VALUE_LIMIT = 4000;

function freeName(prefix: string, taken: readonly string[]): string {
  for (let n = 1; ; n++) if (!taken.includes(`${prefix}_${n}`)) return `${prefix}_${n}`;
}

/** A new app state variable with a free name. */
export function newAppStateVariable(id: string, taken: readonly string[]): AppStateVariable {
  return {
    id,
    name: freeName("variable", taken),
    type: "string",
    isList: false,
    ref: "",
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
    ref: "",
    description: "",
    value: ""
  };
}

/** A new enum with a free name. */
export function newAppEnum(id: string, taken: readonly string[]): AppEnum {
  return { id, name: freeName("Enum", taken), description: "", values: [] };
}

/** A new data type with a free name. */
export function newDataType(id: string, taken: readonly string[]): DataType {
  return { id, name: freeName("DataType", taken), description: "", fields: [] };
}

/** A new data type field with a free name. */
export function newDataTypeField(id: string, taken: readonly string[]): DataTypeField {
  return {
    id,
    name: freeName("field", taken),
    type: "string",
    isList: false,
    ref: "",
    description: ""
  };
}

/** Where an enum or data type is referenced: variables, constants, page state and fields. */
export function typeReferences(
  id: string,
  places: {
    appState: readonly { name: string; ref: string; type: StateType }[];
    constants: readonly { name: string; ref: string; type: StateType }[];
    dataTypes: readonly DataType[];
  }
): string[] {
  const uses = (v: { ref: string; type: StateType }) => REF_TYPES.has(v.type) && v.ref === id;
  return [
    ...places.appState.filter(uses).map((v) => `App state ${v.name}`),
    ...places.constants.filter(uses).map((v) => `Constant ${v.name}`),
    ...places.dataTypes.flatMap((d) =>
      d.fields.filter(uses).map((f) => `Field ${d.name}.${f.name}`)
    )
  ];
}
