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

/** A blank row with the fields a loop's rows have; `{}` when the shape is not known. */
export function loopRowSample(
  query: ElementQuery,
  sources: QuerySources,
  registry?: TypeRegistry
): Record<string, unknown> {
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
