import { GLOBAL_FUNCTIONS, NAMESPACES, runExpression, toText } from "./evaluate";
import { kindOf, membersOf, type ValueKind } from "./methods";
import { ROOT_DOCS } from "./scope";
import type { TypeRegistry, TypeSpec } from "../state";

// Suggestions while typing an expression (n8n style): after a dot, the fields and methods of the
// value before it; otherwise the root names and functions. The value is found by running the part
// before the dot against the current preview data, so suggestions match what is really there.

export interface Completion {
  label: string;
  /** Text that replaces the word being typed. */
  insert: string;
  /** Where the caret goes inside `insert` (after "(" for methods with arguments). */
  caret: number;
  kind: "field" | "method" | "property" | "function" | "namespace" | "variable";
  /** Short type or signature shown beside the label. */
  detail: string;
  description: string;
  example: string;
}

export interface CompletionResult {
  /** Offset in the source where the word being typed starts. */
  from: number;
  items: Completion[];
}

const WORD = /[\w$]*$/;

/** Start of the object expression before the dot at `dot` (balancing brackets and quotes). */
function chainStart(source: string, dot: number): number {
  let depth = 0;
  for (let i = dot - 1; i >= 0; i--) {
    const c = source[i] as string;
    if (c === ")" || c === "]") depth++;
    else if (c === "(" || c === "[") {
      if (depth === 0) return i + 1;
      depth--;
    } else if (depth === 0 && !/[\w$.?"'`]/.test(c)) return i + 1;
  }
  return 0;
}

function preview(value: unknown): string {
  const text = toText(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function methodItems(kind: ValueKind): Completion[] {
  return membersOf(kind).map((doc) => {
    const takesArgs = doc.kind === "method" && !doc.signature.startsWith("()");
    const insert = doc.kind === "method" ? `${doc.name}()` : doc.name;
    return {
      label: doc.name,
      insert,
      caret: takesArgs ? doc.name.length + 1 : insert.length,
      kind: doc.kind,
      detail: doc.kind === "method" ? `${doc.signature} → ${doc.returns}` : doc.returns,
      description: doc.description,
      example: doc.example
    };
  });
}

function fieldItems(value: Record<string, unknown>): Completion[] {
  return Object.keys(value).map((key) => ({
    label: key,
    insert: /^[A-Za-z_$][\w$]*$/.test(key) ? key : `["${key}"]`,
    caret: key.length,
    kind: "field" as const,
    detail: kindOf(value[key]),
    description: `Field of this object. Current value: ${preview(value[key]) || "(empty)"}`,
    example: ""
  }));
}

/** Fields a declared data type has, for a variable that has no value yet. */
function declaredFields(
  spec: TypeSpec | undefined,
  registry: TypeRegistry | undefined
): Completion[] {
  if (!spec || spec.isList || spec.type !== "dataType" || !registry) return [];
  const type = registry.dataTypes.find((d) => d.id === spec.ref);
  return (type?.fields ?? []).map((f) => ({
    label: f.name,
    insert: f.name,
    caret: f.name.length,
    kind: "field" as const,
    detail: f.isList ? `${f.type} list` : f.type,
    description: f.description || `Field of ${type?.name ?? "the data type"}.`,
    example: ""
  }));
}

const KIND_OF_TYPE: Partial<Record<TypeSpec["type"], ValueKind>> = {
  string: "string",
  color: "string",
  url: "string",
  enum: "string",
  number: "number",
  boolean: "boolean",
  timestamptz: "date",
  json: "object",
  dataType: "object",
  supabaseRow: "object"
};

function rootItems(scope: Readonly<Record<string, unknown>>): Completion[] {
  const names: Completion[] = Object.keys(scope).map((name) => ({
    label: name,
    insert: name,
    caret: name.length,
    kind: "variable",
    detail: kindOf(scope[name]),
    description: ROOT_DOCS[name] ?? "",
    example: ""
  }));
  const fns: Completion[] = GLOBAL_FUNCTIONS.map((f) => ({
    label: f.name,
    insert: `${f.name}()`,
    caret: f.name.length + 1,
    kind: "function",
    detail: `${f.signature} → ${f.returns}`,
    description: f.description,
    example: f.example
  }));
  const spaces: Completion[] = Object.entries(NAMESPACES).map(([name, space]) => ({
    label: name,
    insert: name,
    caret: name.length,
    kind: "namespace",
    detail: "namespace",
    description: space.description,
    example: ""
  }));
  return [...names, ...spaces, ...fns];
}

/**
 * Suggestions for the expression text before the caret (`source` starts right after "{{").
 * `hints` gives declared types of variables (keys like "app.cart") for values that are empty.
 */
export function completeExpression(
  source: string,
  scope: Readonly<Record<string, unknown>>,
  options: { hints?: Readonly<Record<string, TypeSpec>>; registry?: TypeRegistry } = {}
): CompletionResult {
  const word = WORD.exec(source)?.[0] ?? "";
  const from = source.length - word.length;
  const filter = (items: Completion[]) => {
    const q = word.toLowerCase();
    const matching = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    return matching.sort(
      (a, b) =>
        Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q))
    );
  };
  const dotAt = source[from - 1] === "." ? from - 1 : -1;
  if (dotAt === -1) {
    // A word right after a closing bracket or quote continues nothing.
    if (/[)\]"'`]$/.test(source.slice(0, from))) return { from, items: [] };
    return { from, items: filter(rootItems(scope)) };
  }
  const objectEnd = source[dotAt - 1] === "?" ? dotAt - 1 : dotAt;
  const objectSource = source.slice(chainStart(source, objectEnd), objectEnd).trim();
  if (!objectSource) return { from, items: [] };
  const namespace = NAMESPACES[objectSource];
  if (namespace)
    return {
      from,
      items: filter(
        namespace.members.map((f) => ({
          label: f.name,
          insert: `${f.name}()`,
          caret: f.name.length + 1,
          kind: "function" as const,
          detail: `${f.signature} → ${f.returns}`,
          description: f.description,
          example: f.example
        }))
      )
    };
  let value: unknown;
  try {
    value = runExpression(objectSource, scope);
  } catch {
    return { from, items: [] };
  }
  const kind = kindOf(value);
  if (kind === "null") {
    const spec = options.hints?.[objectSource];
    const declaredKind = spec ? (spec.isList ? "array" : KIND_OF_TYPE[spec.type]) : undefined;
    const fields = declaredFields(spec, options.registry);
    return { from, items: filter([...fields, ...(declaredKind ? methodItems(declaredKind) : [])]) };
  }
  const fields = kind === "object" ? fieldItems(value as Record<string, unknown>) : [];
  return { from, items: filter([...fields, ...methodItems(kind)]) };
}
