import { z } from "zod";
import { filterInput, QueryInputError } from "../query-run";
import type { SupabaseOperator } from "../query";
import type { SupabaseColumn, SupabaseTable } from "../supabase";
import { getAction, type ActionDef } from "./catalog";
import { PARAM_TEXT_MAX, isRowsField, type Params } from "./fields";
import { walkFlow, type FlowNode } from "./flow";

// Server actions that run today (Supabase rows, Supabase RPC, API Data calls, sign-in actions). The browser never
// sends what to run: it names the saved action node and sends the filled values of the fields that
// hold a {{ tag }} (`actionSlots`). The server finds the node in the saved flows, keeps every fixed
// field as saved, builds the connector request and runs it with the project's connector. Like
// Refresh Query, a visitor can change only the values a tag fills, never the table, columns,
// operator, function or call. Never rely on a value to protect rows: use Row Level Security.

/** Sign-in actions of built apps (docs/app-auth.md section 5): they also read or set the session cookie. */
export const AUTH_ACTION_TYPES = [
  "auth.login",
  "auth.verifyOtp",
  "auth.register",
  "auth.logout",
  "auth.sendPasswordReset",
  "auth.updatePassword",
  "auth.updateEmail",
  "auth.updatePhone",
  "auth.updateUser",
  "auth.resendVerification"
] as const;
export type AuthActionType = (typeof AUTH_ACTION_TYPES)[number];

export const isAuthAction = (type: string): type is AuthActionType =>
  (AUTH_ACTION_TYPES as readonly string[]).includes(type);

export const SERVER_ACTION_TYPES = [
  ...AUTH_ACTION_TYPES,
  "supabase.query",
  "supabase.insert",
  "supabase.upsert",
  "supabase.update",
  "supabase.delete",
  "supabase.rpc",
  "rest.call"
] as const;
export type ServerActionType = (typeof SERVER_ACTION_TYPES)[number];

export const isServerAction = (type: string): type is ServerActionType =>
  (SERVER_ACTION_TYPES as readonly string[]).includes(type);

/** What the browser sends to run a server action. */
export const actionRunRequestSchema = z.object({
  mode: z.enum(["live", "preview"]),
  node: z.string().min(1).max(64),
  /** The filled values of `actionSlots`, in the same order. */
  values: z.array(z.string().max(PARAM_TEXT_MAX)).max(300).default([])
});
export type ActionRunRequest = z.infer<typeof actionRunRequestSchema>;

const hasTag = (text: string) => text.includes("{{");

/** Visits every tag-holding text of the params in the fixed slot order; `set` replaces it. */
function eachSlot(def: ActionDef, params: Params, visit: (text: string) => string | void): Params {
  const next = structuredClone(params);
  for (const field of def.fields) {
    const value = next[field.key];
    if (typeof value === "string") {
      if (hasTag(value)) next[field.key] = visit(value) ?? value;
    } else if (Array.isArray(value) && isRowsField(field)) {
      for (const row of value) {
        for (const key of Object.keys(row).sort()) {
          const text = row[key] ?? "";
          if (hasTag(text)) row[key] = visit(text) ?? text;
        }
      }
    }
  }
  return next;
}

/**
 * The texts the browser fills before running the action, in a fixed order (the definition's field
 * order, row by row, cell by cell): every field or cell whose saved text holds a {{ tag }}.
 */
export function actionSlots(def: ActionDef, params: Params): string[] {
  const slots: string[] = [];
  eachSlot(def, params, (text) => {
    slots.push(text);
  });
  return slots;
}

/**
 * A copy of the params whose tag-holding texts take the browser's filled values (by position).
 * Fixed text stays as saved, so a visitor cannot change it; a missing value becomes "".
 */
export function withActionValues(
  def: ActionDef,
  params: Params,
  values: readonly string[]
): Params {
  let at = 0;
  return eachSlot(def, params, () => values[at++] ?? "");
}

/** The saved, enabled server action node `nodeId` of these flows, or null. */
export function findServerAction(
  flows: readonly (readonly FlowNode[])[],
  nodeId: string
): { def: ActionDef; params: Params } | null {
  let found: { def: ActionDef; params: Params } | null = null;
  for (const nodes of flows) {
    walkFlow(nodes, (node) => {
      if (found || node.id !== nodeId || node.kind !== "action" || node.disabled) return;
      const def = getAction(node.type);
      if (def && isServerAction(def.type)) found = { def, params: node.params };
    });
    if (found) break;
  }
  return found;
}

const rowsOf = (value: unknown): Record<string, string>[] =>
  Array.isArray(value) ? (value as Record<string, string>[]) : [];
const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/** `name` or `schema.name` (see `tableRef`) as a schema and a table name. */
export function splitTableRef(ref: string): { schema: string; table: string } {
  const dot = ref.indexOf(".");
  return dot === -1
    ? { schema: "public", table: ref }
    : { schema: ref.slice(0, dot), table: ref.slice(dot + 1) };
}

/** A filled value typed for its column: numbers, booleans and JSON are parsed, "" is null. */
export function columnInput(column: SupabaseColumn, text: string): unknown {
  if (text.trim() === "") return null;
  if (column.isList)
    return text
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");
  switch (column.type) {
    case "int":
    case "float": {
      const n = Number(text);
      if (!Number.isFinite(n))
        throw new QueryInputError(`"${text}" is not a number for ${column.name}.`);
      return column.type === "int" ? Math.trunc(n) : n;
    }
    case "boolean":
      if (text !== "true" && text !== "false")
        throw new QueryInputError(`${column.name} takes true or false.`);
      return text === "true";
    case "json":
      try {
        return JSON.parse(text);
      } catch {
        throw new QueryInputError(`${column.name} is not valid JSON.`);
      }
    default:
      return text;
  }
}

const OPERATORS = new Set<string>([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
  "contains",
  "containedBy",
  "overlaps"
]);

export interface ConnectorCall {
  resourceId: string;
  params: Record<string, unknown>;
}

/** What a server action asks the connector to do, with the table's saved structure checked. */
export function supabaseActionCall(
  type: ServerActionType,
  params: Params,
  tables: (schema: string, table: string) => SupabaseTable | null
): ConnectorCall {
  if (type === "supabase.rpc") {
    const args: Record<string, unknown> = {};
    for (const row of rowsOf(params.args)) if (row.name) args[row.name] = row.value ?? "";
    return { resourceId: `rpc:${textOf(params.function)}`, params: { op: "rpc", args } };
  }
  const ref = splitTableRef(textOf(params.table));
  const table = tables(ref.schema, ref.table);
  if (!table) throw new QueryInputError(`Fetch the schema that has "${textOf(params.table)}".`);
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const column = (name: string) => {
    const found = columns.get(name);
    if (!found) throw new QueryInputError(`No column "${name}".`);
    return found;
  };
  const filters = rowsOf(params.filters).map((row) => {
    const op = row.operator ?? "eq";
    if (!OPERATORS.has(op)) throw new QueryInputError(`Unknown operator "${op}".`);
    const c = column(row.column ?? "");
    return {
      column: c.name,
      operator: op as SupabaseOperator,
      value: filterInput(c, op as SupabaseOperator, row.value ?? "")
    };
  });
  const values = () =>
    Object.fromEntries(
      rowsOf(params.values).map((row) => {
        const c = column(row.column ?? "");
        return [c.name, columnInput(c, row.value ?? "")];
      })
    );
  const resourceId = `${table.kind}:${table.name}`;
  const schema = ref.schema;
  switch (type) {
    case "supabase.query":
      return {
        resourceId,
        params: {
          op: "select",
          schema,
          ...(textOf(params.select).trim() ? { select: textOf(params.select) } : {}),
          filters,
          order: rowsOf(params.order).map((o) => ({
            column: column(o.column ?? "").name,
            ascending: o.direction !== "desc"
          })),
          limit:
            params.single === "true" ? 1 : Math.min(1000, Math.max(1, Number(params.limit) || 100))
        }
      };
    case "supabase.insert":
      return { resourceId, params: { op: "insert", schema, values: values() } };
    case "supabase.upsert":
      return {
        resourceId,
        params: {
          op: "insert",
          schema,
          values: values(),
          upsert: true,
          ...(textOf(params.onConflict).trim() ? { onConflict: textOf(params.onConflict) } : {})
        }
      };
    case "supabase.update":
      return { resourceId, params: { op: "update", schema, values: values(), filters } };
    case "supabase.delete":
      return { resourceId, params: { op: "delete", schema, filters } };
    default:
      throw new QueryInputError("This action does not run on Supabase.");
  }
}
