import type { SupabaseStructure, SupabaseTable } from "../supabase";
import type { ParamRow, Params } from "./fields";

// Checks of Supabase database actions against the saved structure (columns, required values),
// so a flow that would fail at run time shows an issue in the editor first.

/** A table of the saved structure by its reference: `name` in public, `schema.name` elsewhere. */
export function tableByRef(structure: SupabaseStructure, ref: string): SupabaseTable | null {
  const dot = ref.indexOf(".");
  const schema = dot === -1 ? "public" : ref.slice(0, dot);
  const name = dot === -1 ? ref : ref.slice(dot + 1);
  const entry = structure.schemas.find((s) => s.schema === schema);
  return entry?.tables.find((t) => t.name === name) ?? null;
}

const rowsOf = (params: Params, key: string): ParamRow[] => {
  const value = params[key];
  return Array.isArray(value) ? value : [];
};

/** Messages for one Supabase database action; none when the structure is unknown. */
export function supabaseActionProblems(
  type: string,
  params: Params,
  structure: SupabaseStructure | null | undefined
): string[] {
  const ref = typeof params.table === "string" ? params.table.trim() : "";
  if (!structure || !ref) return [];
  const table = tableByRef(structure, ref);
  if (!table) return [`The table "${ref}" is not in the saved Supabase structure.`];
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const problems: string[] = [];
  const unknown = (where: string, name: string) => {
    if (name && !columns.has(name)) problems.push(`${where}: "${name}" is not a column of ${ref}.`);
  };
  for (const key of ["filters", "order"]) {
    const where = key === "order" ? "Order" : "Filters";
    for (const row of rowsOf(params, key)) unknown(where, row.column ?? "");
  }
  for (const key of ["select", "onConflict"]) {
    const list = typeof params[key] === "string" ? params[key] : "";
    for (const name of list.split(",").map((n) => n.trim())) unknown("Columns", name);
  }
  if (!["supabase.insert", "supabase.upsert", "supabase.update"].includes(type)) return problems;

  const given = new Set<string>();
  for (const row of rowsOf(params, "values")) {
    const name = row.column ?? "";
    unknown("Values", name);
    const column = columns.get(name);
    if (!column) continue;
    if ((row.value ?? "").trim() === "") {
      if (!column.nullable) problems.push(`Values: "${name}" cannot be empty in ${ref}.`);
    } else given.add(name);
  }
  // Update changes only the columns it names; insert and upsert need every column without a default.
  if (type !== "supabase.update") {
    for (const column of table.columns) {
      if (!column.nullable && !column.hasDefault && !given.has(column.name)) {
        problems.push(
          `Values: "${column.name}" is required in ${ref} (no default, cannot be empty).`
        );
      }
    }
  }
  return problems;
}
