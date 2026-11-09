import { findTable, type ElementQuery, type QuerySources } from "./query";
import type { StateType, TypeRegistry } from "./state";

// An empty row shaped like what a query loop gives, for the editor's suggestion panel: Supabase
// rows have the table's columns, REST rows the fields of the data type the call's list is read as.
// Values are typed blanks ("" , 0, false, [], {}) so fields and their methods can be suggested;
// no row data is fetched or stored.

interface Typed {
  type: StateType | string;
  isList: boolean;
  ref?: string;
}

const MAX_DEPTH = 3;

function blank(spec: Typed, registry: TypeRegistry | undefined, depth: number): unknown {
  if (spec.isList) return [];
  switch (spec.type) {
    case "int":
    case "float":
      return 0;
    case "boolean":
      return false;
    case "json":
    case "supabaseRow":
      return {};
    case "dataType":
      return dataTypeSample(spec.ref ?? "", registry, depth + 1);
    default:
      return "";
  }
}

function dataTypeSample(
  id: string,
  registry: TypeRegistry | undefined,
  depth: number
): Record<string, unknown> {
  const type = registry?.dataTypes.find((d) => d.id === id);
  if (!type || depth > MAX_DEPTH) return {};
  return Object.fromEntries(type.fields.map((f) => [f.name, blank(f, registry, depth)]));
}

/** Variables an Other Loops loop can read, by source, for shaping its rows. */
export type LoopVariables = Partial<
  Record<"param" | "state" | "app" | "const", readonly (Typed & { name: string })[]>
>;

/** The first item of a JSON array, with its fields as typed blanks. */
function jsonSample(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
    if (first === null || typeof first !== "object" || Array.isArray(first)) return {};
    return Object.fromEntries(
      Object.entries(first).map(([key, v]) => [
        key,
        Array.isArray(v)
          ? []
          : typeof v === "object" && v !== null
            ? {}
            : typeof v === "number"
              ? 0
              : typeof v === "boolean"
                ? false
                : ""
      ])
    );
  } catch {
    return {};
  }
}

/** A blank row with the fields a loop's rows have; `{}` when the shape is not known. */
export function loopRowSample(
  query: ElementQuery,
  sources: QuerySources,
  registry?: TypeRegistry,
  variables: LoopVariables = {}
): Record<string, unknown> {
  if (query.source === "local") {
    const { kind } = query.local;
    if (kind === "json") return jsonSample(query.local.json);
    if (kind === "parent" || kind === "expression") return {};
    const found = variables[kind]?.find((v) => v.name === query.local.variable);
    return found?.type === "dataType" ? dataTypeSample(found.ref ?? "", registry, 0) : {};
  }
  if (query.source === "supabase") {
    const table = findTable(sources.supabase, query.supabase.schema, query.supabase.table);
    return Object.fromEntries((table?.columns ?? []).map((c) => [c.name, blank(c, registry, 0)]));
  }
  const call = sources.rest?.calls.find((c) => c.id === query.rest.callId);
  if (!call) return {};
  if (query.rest.listPath) {
    const path = call.response.jsonPaths.find((p) => p.id === query.rest.listPath);
    return path?.type === "dataType" ? dataTypeSample(path.ref, registry, 0) : {};
  }
  return call.response.parseAsDataType ? dataTypeSample(call.response.dataTypeId, registry, 0) : {};
}
