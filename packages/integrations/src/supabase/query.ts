import { z } from "zod";

// Requests a Supabase connector runs, and how they become PostgREST and Storage API calls.
// Column names and operators are validated, and every value is URL-encoded, so a request can only
// ever read or write what the anon key's role and the project's RLS allow.

const column = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use a column name of letters, digits and underscores.")
  .max(63);

export const filterSchema = z.discriminatedUnion("operator", [
  z.object({
    column,
    operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike"]),
    value: z.union([z.string().max(10_000), z.number(), z.boolean()])
  }),
  z.object({ column, operator: z.literal("is"), value: z.union([z.null(), z.boolean()]) }),
  // Containment for array and JSON columns: a list (`{a,b}`) or a JSON object or array.
  z.object({
    column,
    operator: z.enum(["contains", "containedBy", "overlaps"]),
    value: z.union([
      z
        .array(z.union([z.string().max(1000), z.number()]))
        .min(1)
        .max(500),
      z.record(z.unknown())
    ])
  }),
  z.object({
    column,
    operator: z.literal("in"),
    value: z
      .array(z.union([z.string().max(1000), z.number()]))
      .min(1)
      .max(500)
  })
]);

const filters = z.array(filterSchema).max(50);
/** Exposed schema to use instead of the connection's (sent as Accept-Profile / Content-Profile). */
const schema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use a schema name such as public.")
  .max(63)
  .optional();
const row = z.record(column, z.unknown());

/** A select list such as `id,title,author:profiles(name)`; no quotes, semicolons or slashes. */
const selectList = z
  .string()
  .max(2000)
  .regex(/^[A-Za-z0-9_,.*:()!\->\s]*$/, "The column list has characters PostgREST does not use.");

export const supabaseRequestSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("select"),
    schema,
    select: selectList.optional(),
    filters: filters.default([]),
    order: z
      .array(z.object({ column, ascending: z.boolean().default(true) }))
      .max(10)
      .default([]),
    limit: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).max(1_000_000).optional()
  }),
  z.object({
    op: z.literal("insert"),
    schema,
    values: z.union([row, z.array(row).min(1).max(1000)]),
    // Upsert: a row that clashes on the conflict columns (the primary key when none) is updated.
    upsert: z.boolean().default(false),
    onConflict: z
      .string()
      .max(500)
      .regex(/^[A-Za-z_][A-Za-z0-9_]*(,[A-Za-z_][A-Za-z0-9_]*)*$/, "List column names with commas.")
      .optional()
  }),
  // Updates and deletes need at least one filter so a missing condition never hits every row.
  z.object({ op: z.literal("update"), schema, values: row, filters: filters.min(1) }),
  z.object({ op: z.literal("delete"), schema, filters: filters.min(1) }),
  z.object({ op: z.literal("rpc"), schema, args: z.record(z.unknown()).default({}) }),
  z.object({ op: z.literal("storage.list"), prefix: z.string().max(1024).default("") }),
  // Stores one file (base64 bytes) at a path of a bucket. The bucket's policies decide who may.
  z.object({
    op: z.literal("storage.upload"),
    path: z.string().min(1).max(1024),
    data: z.string().max(80_000_000),
    contentType: z.string().min(1).max(200).default("application/octet-stream"),
    upsert: z.boolean().default(false)
  }),
  z.object({
    op: z.literal("storage.remove"),
    paths: z.array(z.string().min(1).max(1024)).min(1).max(100)
  }),
  // A short-lived signed URL for one object of a private bucket (the anon role needs read access).
  z.object({
    op: z.literal("storage.sign"),
    path: z.string().min(1).max(1024),
    expiresIn: z.number().int().min(60).max(3600).default(600)
  })
]);

export type SupabaseRequest = z.infer<typeof supabaseRequestSchema>;
export type SupabaseFilter = z.infer<typeof filterSchema>;

/** `table:name`, `view:name`, `rpc:name` or `bucket:name`. */
export function parseResourceId(id: string): {
  kind: "table" | "view" | "rpc" | "bucket";
  name: string;
} {
  const match = /^(table|view|rpc|bucket):(.+)$/.exec(id);
  if (!match?.[1] || !match[2]) throw new Error("Unknown resource.");
  return { kind: match[1] as "table" | "view" | "rpc" | "bucket", name: match[2] };
}

/** A value inside `in.(...)`: quoted when it holds PostgREST's reserved characters. */
function listItem(value: string | number): string {
  const text = String(value);
  return /[,()".:\s]/.test(text) ? `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : text;
}

const CONTAINMENT = { contains: "cs", containedBy: "cd", overlaps: "ov" } as const;

/** A value inside a PostgreSQL array literal `{...}`: quoted when it holds reserved characters. */
function arrayItem(value: string | number): string {
  const text = String(value);
  return /[,{}"\\\s]/.test(text) ? `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : text;
}

function filterValue(filter: SupabaseFilter): string {
  if (
    filter.operator === "contains" ||
    filter.operator === "containedBy" ||
    filter.operator === "overlaps"
  ) {
    const code = CONTAINMENT[filter.operator];
    return Array.isArray(filter.value)
      ? `${code}.{${filter.value.map(arrayItem).join(",")}}`
      : `${code}.${JSON.stringify(filter.value)}`;
  }
  if (filter.operator === "in") return `in.(${filter.value.map(listItem).join(",")})`;
  if (filter.operator === "is")
    return `is.${filter.value === null ? "null" : String(filter.value)}`;
  return `${filter.operator}.${String(filter.value)}`;
}

/** Query string for a PostgREST table call: filters, select, order, limit and offset. */
export function tableQuery(request: SupabaseRequest): URLSearchParams {
  const params = new URLSearchParams();
  if ("filters" in request)
    for (const f of request.filters) params.append(f.column, filterValue(f));
  if (request.op === "select") {
    if (request.select?.trim()) params.set("select", request.select.replace(/\s+/g, ""));
    if (request.order.length > 0)
      params.set(
        "order",
        request.order.map((o) => `${o.column}.${o.ascending ? "asc" : "desc"}`).join(",")
      );
    if (request.limit !== undefined) params.set("limit", String(request.limit));
    if (request.offset !== undefined) params.set("offset", String(request.offset));
  }
  if (request.op === "insert" && request.upsert && request.onConflict)
    params.set("on_conflict", request.onConflict);
  if (request.op === "insert" || request.op === "update" || request.op === "delete") {
    // Ask PostgREST to send back the rows it changed.
    if (!params.has("select")) params.set("select", "*");
  }
  return params;
}

export const TABLE_METHODS = {
  select: "GET",
  insert: "POST",
  update: "PATCH",
  delete: "DELETE"
} as const;
