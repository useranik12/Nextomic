import { z } from "zod";
import { IDENTIFIER_PATTERN, parseStateValue, stateNameProblem, type StateType } from "./state";

// API Data: REST calls in groups (docs/integrations.md section 4). One REST connector per project
// holds every group and call in its config. Secret values (tokens, passwords, API keys) are not
// here: they live in the connector's sealed secrets under `<group or call id>.<field>`.

export const REST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "QUERY"] as const;
export type RestMethod = (typeof REST_METHODS)[number];

/** Methods that send a body. GET and OPTIONS never do. */
export const BODY_METHODS: ReadonlySet<RestMethod> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "QUERY"
]);

export const REST_BODY_TYPES = ["none", "json", "text", "multipart", "form"] as const;
export type RestBodyType = (typeof REST_BODY_TYPES)[number];

export const REST_AUTH_TYPES = ["none", "bearer", "basic", "apiKey"] as const;
export type RestAuthType = (typeof REST_AUTH_TYPES)[number];

/** Types an API variable or a JSON path can have. */
export const REST_VALUE_TYPES = [
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

/** Values the server fills; a call may use them without defining them. */
export const BUILT_IN_REST_VARIABLES = ["jwt", "user_ip"] as const;

/** Secret fields of an auth block, by auth type. */
export const AUTH_SECRET_FIELDS: Record<RestAuthType, readonly string[]> = {
  none: [],
  bearer: ["token"],
  basic: ["password"],
  apiKey: ["apiKey"]
};

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Give it a name.").max(80);
const text = (max: number) => z.string().max(max).default("");

export const restHeaderSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, "A header name has letters, digits and - only."),
  value: text(8000)
});

/** A multipart or form field: a name and a text value (placeholders allowed). */
export const restFieldSchema = z.object({
  key: z.string().trim().min(1).max(200),
  value: text(20_000)
});

export const restAuthSchema = z.object({
  type: z.enum(REST_AUTH_TYPES).default("none"),
  /** Basic auth user name (the password is a secret). */
  username: text(200),
  /** API key: the header or query parameter name, and where it goes (the key is a secret). */
  apiKeyName: text(200),
  apiKeyIn: z.enum(["header", "query"]).default("header")
});

export const restVariableSchema = z.object({
  id,
  name: z.string().superRefine((value, ctx) => {
    const problem = stateNameProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
    if ((BUILT_IN_REST_VARIABLES as readonly string[]).includes(value))
      ctx.addIssue({ code: "custom", message: `"${value}" is filled by the server.` });
  }),
  type: z.enum(REST_VALUE_TYPES).default("string"),
  /** The enum or data type id for enum and data type variables. */
  ref: text(64),
  isList: z.boolean().default(false),
  defaultValue: text(100_000),
  /** Usually bound to dynamic data where the call is used (the bolt in the Variables table). */
  dynamic: z.boolean().default(false)
});

export const restJsonPathSchema = z.object({
  id,
  path: z.string().trim().min(1).max(500),
  name: z.string().regex(IDENTIFIER_PATTERN, "Use letters, digits and _.").max(64),
  type: z.enum(REST_VALUE_TYPES).default("string"),
  ref: text(64),
  isList: z.boolean().default(false)
});

export const restResponseSchema = z.object({
  /** Read the whole response as one app data type (or a list of it). */
  parseAsDataType: z.boolean().default(false),
  dataTypeId: text(64),
  isList: z.boolean().default(false),
  jsonPaths: z.array(restJsonPathSchema).max(200).default([])
});

export const restGroupSchema = z.object({
  id,
  name,
  baseUrl: z.string().trim().max(2000).default(""),
  headers: z.array(restHeaderSchema).max(100).default([]),
  auth: restAuthSchema.default({}),
  includeCredentials: z.boolean().default(false)
});

export const restCallSchema = z.object({
  id,
  name,
  active: z.boolean().default(true),
  /** Null: an ungrouped call with its own full URL and auth. */
  groupId: id.nullable().default(null),
  method: z.enum(REST_METHODS).default("GET"),
  /** The endpoint appended to the group base URL, or the full URL of an ungrouped call. */
  url: z.string().trim().max(4000).default(""),
  headers: z.array(restHeaderSchema).max(100).default([]),
  bodyType: z.enum(REST_BODY_TYPES).default("none"),
  /** JSON or text body with `<variable>` placeholders. */
  body: text(200_000),
  /** Multipart and form fields. */
  fields: z.array(restFieldSchema).max(200).default([]),
  variables: z.array(restVariableSchema).max(200).default([]),
  /** Ungrouped calls only; a grouped call uses its group's auth. */
  auth: restAuthSchema.default({}),
  includeCredentials: z.boolean().default(false),
  response: restResponseSchema.default({})
});

export const restConfigSchema = z.object({
  groups: z.array(restGroupSchema).max(200).default([]),
  calls: z.array(restCallSchema).max(1000).default([])
});

export type RestHeader = z.infer<typeof restHeaderSchema>;
export type RestField = z.infer<typeof restFieldSchema>;
export type RestAuth = z.infer<typeof restAuthSchema>;
export type RestVariable = z.infer<typeof restVariableSchema>;
export type RestJsonPath = z.infer<typeof restJsonPathSchema>;
export type RestResponse = z.infer<typeof restResponseSchema>;
export type RestGroup = z.infer<typeof restGroupSchema>;
export type RestCall = z.infer<typeof restCallSchema>;
export type RestConfig = z.infer<typeof restConfigSchema>;

export const newRestCall = (callId: string, groupId: string | null, callName: string): RestCall =>
  restCallSchema.parse({ id: callId, name: callName, groupId });

export const newRestGroup = (groupId: string, groupName: string): RestGroup =>
  restGroupSchema.parse({ id: groupId, name: groupName });

// ------------------------------------------------------------------ header lines

/** `key: value` as typed in the Header tab, or why it cannot be read. */
export function parseHeaderLine(line: string): { header: RestHeader } | { error: string } {
  const at = line.indexOf(":");
  if (at <= 0) return { error: "Write the header as key: value." };
  const parsed = restHeaderSchema.safeParse({
    key: line.slice(0, at).trim(),
    value: line.slice(at + 1).trim()
  });
  return parsed.success
    ? { header: parsed.data }
    : { error: parsed.error.issues[0]?.message ?? "This header is not valid." };
}

export const headerLine = (header: RestHeader) => `${header.key}: ${header.value}`;

// ------------------------------------------------------------------ placeholders

const BRACKET = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g;
const ANGLE = /<([A-Za-z_][A-Za-z0-9_]*)>/g;

/** `[name]` placeholders of a URL, endpoint, header or field value, in order, once each. */
export function bracketPlaceholders(source: string): string[] {
  return [...new Set([...source.matchAll(BRACKET)].map((m) => m[1] as string))];
}

/** `<name>` placeholders of a JSON or text body, in order, once each. */
export function anglePlaceholders(source: string): string[] {
  return [...new Set([...source.matchAll(ANGLE)].map((m) => m[1] as string))];
}

/** Every placeholder a call uses (URL, headers, body, fields) and the group's base URL and headers. */
export function callPlaceholders(call: RestCall, group: RestGroup | null): string[] {
  const bracketSources = [
    call.url,
    ...call.headers.map((h) => `${h.key} ${h.value}`),
    ...call.fields.map((f) => f.value),
    ...(group ? [group.baseUrl, ...group.headers.map((h) => h.value)] : [])
  ];
  const fromBody =
    call.bodyType === "json" || call.bodyType === "text" ? anglePlaceholders(call.body) : [];
  return [...new Set([...bracketSources.flatMap(bracketPlaceholders), ...fromBody])];
}

/** Variable names chips can insert: the call's own variables, then the built-in ones. */
export const insertableVariables = (call: RestCall): string[] => [
  ...call.variables.map((v) => v.name),
  ...BUILT_IN_REST_VARIABLES
];

// ------------------------------------------------------------------ JSON body

export interface JsonBodyProblem {
  message: string;
  line: number;
  column: number;
}

/** True when position `at` of a JSON text is inside a string literal. */
function insideJsonString(source: string, at: number): boolean {
  let inside = false;
  for (let i = 0; i < at; i++) {
    const char = source[i];
    if (char === "\\" && inside) i++;
    else if (char === '"') inside = !inside;
  }
  return inside;
}

/** The body with each unquoted `<name>` replaced by `stand`, so it can be parsed or formatted. */
function standIn(source: string, stand: (name: string, index: number) => string): string {
  let index = 0;
  return source.replace(ANGLE, (match, placeholder: string, offset: number) =>
    insideJsonString(source, offset) ? match : stand(placeholder, index++)
  );
}

function lineAndColumn(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  return { line, column: offset - before.lastIndexOf("\n") };
}

/** Why a JSON body with `<variable>` placeholders cannot be read, or null when it can. */
export function jsonBodyProblem(source: string): JsonBodyProblem | null {
  if (source.trim() === "") return null;
  // Stand-ins never span lines, so the reported line is right; the column may shift a little.
  const parsable = standIn(source, () => "0");
  try {
    JSON.parse(parsable);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The JSON could not be read.";
    const position = /position (\d+)/.exec(message);
    const offset = position ? Number(position[1]) : parsable.length;
    const shown = message.replace(/ in JSON at position \d+.*$/, "").replace(/^JSON\.parse: /, "");
    return { message: shown, ...lineAndColumn(parsable, Math.min(offset, parsable.length)) };
  }
}

/** The JSON body formatted with two spaces, placeholders kept; null when it cannot be read. */
export function formatJsonBody(source: string): string | null {
  if (source.trim() === "") return source;
  const names: string[] = [];
  const parsable = standIn(source, (placeholder) => {
    names.push(placeholder);
    return `"@@nxph_${names.length - 1}@@"`;
  });
  try {
    const formatted = JSON.stringify(JSON.parse(parsable), null, 2);
    return formatted.replace(/"@@nxph_(\d+)@@"/g, (_, i: string) => `<${names[Number(i)]}>`);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ problems

/** Everything that stops a call from being saved, in display order. Empty when it can be saved. */
export function callProblems(call: RestCall, group: RestGroup | null): string[] {
  const problems: string[] = [];
  const names = new Set<string>();
  for (const variable of call.variables) {
    if (names.has(variable.name)) problems.push(`Two variables are named "${variable.name}".`);
    names.add(variable.name);
  }
  const known = new Set([...names, ...BUILT_IN_REST_VARIABLES]);
  for (const placeholder of callPlaceholders(call, group))
    if (!known.has(placeholder))
      problems.push(`"${placeholder}" is used but not defined in Variables.`);
  if (call.groupId === null && call.url.trim() === "") problems.push("Enter the API URL.");
  if (call.groupId === null && call.url.trim() !== "" && !/^https?:\/\//i.test(call.url))
    problems.push("The API URL must start with https://.");
  if (call.bodyType === "json" && BODY_METHODS.has(call.method)) {
    const problem = jsonBodyProblem(call.body);
    if (problem) problems.push(`Body line ${problem.line}: ${problem.message}`);
  }
  const paths = new Set<string>();
  for (const path of call.response.jsonPaths) {
    if (paths.has(path.name)) problems.push(`Two JSON paths are named "${path.name}".`);
    paths.add(path.name);
  }
  return problems;
}

// ------------------------------------------------------------------ filling a request

/** A variable's value as the call uses it: the passed value, else its default, typed. */
export function variableValue(variable: RestVariable, passed: unknown): unknown {
  const raw = passed === undefined || passed === null || passed === "" ? undefined : passed;
  if (raw === undefined) {
    if (variable.defaultValue === "") return variable.isList ? [] : "";
    return parseStateValue(variable, variable.defaultValue);
  }
  return typeof raw === "string" ? (parseStateValue(variable, raw) ?? raw) : raw;
}

const asText = (value: unknown): string =>
  value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

/** Fills `[name]` placeholders; `encode` percent-encodes values (URLs). */
export function fillBrackets(
  source: string,
  values: Record<string, unknown>,
  encode = false
): string {
  return source.replace(BRACKET, (match, placeholder: string) =>
    placeholder in values
      ? encode
        ? encodeURIComponent(asText(values[placeholder]))
        : asText(values[placeholder])
      : match
  );
}

/**
 * Fills `<name>` placeholders of a JSON body: inside a string the value is escaped text, outside
 * it is the value as JSON (a string becomes a quoted string, a list an array).
 */
export function fillJsonBody(source: string, values: Record<string, unknown>): string {
  return source.replace(ANGLE, (match, placeholder: string, offset: number) => {
    if (!(placeholder in values)) return match;
    const value = values[placeholder];
    if (insideJsonString(source, offset)) return JSON.stringify(asText(value)).slice(1, -1);
    return JSON.stringify(value === undefined ? null : value);
  });
}

/** Fills `<name>` placeholders of a text body with plain text. */
export const fillTextBody = (source: string, values: Record<string, unknown>): string =>
  source.replace(ANGLE, (match, placeholder: string) =>
    placeholder in values ? asText(values[placeholder]) : match
  );

/** Joins a base URL and an endpoint with exactly one slash. */
export function joinUrl(base: string, endpoint: string): string {
  if (!endpoint) return base;
  if (!base) return endpoint;
  return `${base.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}
