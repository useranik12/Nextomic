import type { StateType } from "./state";

// JSON paths for API responses (docs/integrations.md section 4): `$` is the response, `.name` or
// `["name"]` a field, `[2]` an item, `[:]` or `[*]` every item. A path with `[:]` gives a flat
// list. The builder reads responses with JSON.parse, so paths only walk plain values.

export type PathStep =
  | { kind: "key"; key: string }
  | { kind: "index"; index: number }
  | { kind: "all" };

/** The steps of a path, or an error message. */
export function parseJsonPath(path: string): { steps: PathStep[] } | { error: string } {
  const source = path.trim();
  if (!source.startsWith("$")) return { error: "A JSON path starts with $." };
  const steps: PathStep[] = [];
  let at = 1;
  while (at < source.length) {
    const rest = source.slice(at);
    const key = /^\.([A-Za-z_$][\w$-]*)/.exec(rest);
    if (key?.[1]) {
      steps.push({ kind: "key", key: key[1] });
      at += key[0].length;
      continue;
    }
    const quoted = /^\[\s*(["'])((?:\\.|(?!\1).)*)\1\s*\]/.exec(rest);
    if (quoted) {
      steps.push({ kind: "key", key: (quoted[2] ?? "").replace(/\\(.)/g, "$1") });
      at += quoted[0].length;
      continue;
    }
    const index = /^\[\s*(\d+)\s*\]/.exec(rest);
    if (index) {
      steps.push({ kind: "index", index: Number(index[1]) });
      at += index[0].length;
      continue;
    }
    const all = /^\[\s*(:|\*)\s*\]/.exec(rest);
    if (all) {
      steps.push({ kind: "all" });
      at += all[0].length;
      continue;
    }
    return { error: `Cannot read the path at "${rest.slice(0, 12)}".` };
  }
  return { steps };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The value at a path: a list when the path has `[:]`, `null` where nothing is found. */
export function readJsonPath(value: unknown, path: string): unknown {
  const parsed = parseJsonPath(path);
  if ("error" in parsed) return null;
  let current: unknown[] = [value];
  let spread = false;
  for (const step of parsed.steps) {
    const next: unknown[] = [];
    for (const item of current) {
      if (step.kind === "all") {
        spread = true;
        if (Array.isArray(item)) next.push(...item);
      } else if (step.kind === "index") {
        if (Array.isArray(item) && step.index < item.length) next.push(item[step.index]);
      } else if (isRecord(item) && Object.hasOwn(item, step.key)) {
        next.push(item[step.key]);
      }
    }
    current = next;
  }
  if (spread) return current;
  return current.length > 0 ? current[0] : null;
}

/** The app type of a value: arrays give their first item's type as a list. */
export function inferJsonType(value: unknown): { type: StateType; isList: boolean } {
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== null && v !== undefined);
    const inner = first === undefined ? "string" : inferJsonType(first).type;
    return { type: Array.isArray(first) ? "json" : inner, isList: true };
  }
  if (typeof value === "boolean") return { type: "boolean", isList: false };
  if (typeof value === "number")
    return { type: Number.isInteger(value) ? "int" : "float", isList: false };
  if (isRecord(value)) return { type: "json", isList: false };
  return { type: "string", isList: false };
}

const keyStep = (key: string) =>
  /^[A-Za-z_$][\w$-]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;

/** Paths worth adding: the top-level fields, through the root list when the response is one. */
export function recommendedJsonPaths(value: unknown, limit = 30): string[] {
  if (Array.isArray(value)) {
    const first = value.find(isRecord);
    return first
      ? Object.keys(first)
          .slice(0, limit)
          .map((k) => `$[:]${keyStep(k)}`)
      : ["$"];
  }
  if (isRecord(value))
    return Object.keys(value)
      .slice(0, limit)
      .map((k) => `$${keyStep(k)}`);
  return ["$"];
}

/** A short one-line preview of a value for the Response Preview column. */
export function previewJson(value: unknown, max = 120): string {
  const text = value === undefined ? "null" : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The STRUCTURE of a response (types and field names, never values), saved for dynamic data. */
export type JsonShape =
  | { kind: "object"; fields: Record<string, JsonShape> }
  | { kind: "list"; item: JsonShape | null }
  | { kind: "string" | "int" | "float" | "boolean" | "null" };

/** The shape of a value, to `depth` levels and `maxKeys` fields per object. */
export function jsonShape(value: unknown, depth = 8, maxKeys = 200): JsonShape {
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== null && v !== undefined);
    return {
      kind: "list",
      item: first === undefined || depth <= 0 ? null : jsonShape(first, depth - 1, maxKeys)
    };
  }
  if (isRecord(value)) {
    const fields: Record<string, JsonShape> = {};
    if (depth > 0)
      for (const key of Object.keys(value).slice(0, maxKeys))
        fields[key] = jsonShape(value[key], depth - 1, maxKeys);
    return { kind: "object", fields };
  }
  if (typeof value === "boolean") return { kind: "boolean" };
  if (typeof value === "number") return { kind: Number.isInteger(value) ? "int" : "float" };
  if (typeof value === "string") return { kind: "string" };
  return { kind: "null" };
}
