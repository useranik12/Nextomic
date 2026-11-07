import {
  nextomicTypeOf,
  splitArrayType,
  type SupabaseColumn,
  type SupabaseFunction,
  type SupabaseTable
} from "@nextomic/schema";
import { z } from "zod";

// Reads PostgREST's OpenAPI 2.0 document (GET /rest/v1/ with the anon key) into table, view and
// function structure. PostgREST lists only what the key's role may reach, and marks keys in the
// column descriptions: `<pk/>` for primary keys, `<fk table='t' column='c'/>` for foreign keys.

const propertySchema = z
  .object({
    format: z.string().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    items: z.object({ format: z.string().optional(), type: z.string().optional() }).optional()
  })
  .passthrough();

const definitionSchema = z
  .object({
    description: z.string().optional(),
    required: z.array(z.string()).optional(),
    properties: z.record(propertySchema).optional()
  })
  .passthrough();

const parameterSchema = z
  .object({
    name: z.string().optional(),
    in: z.string().optional(),
    format: z.string().optional(),
    schema: z
      .object({ properties: z.record(propertySchema).optional() })
      .passthrough()
      .optional()
  })
  .passthrough();

const operationSchema = z.object({ parameters: z.array(z.unknown()).optional() }).passthrough();

export const openApiSchema = z
  .object({
    swagger: z.string().optional(),
    definitions: z.record(definitionSchema).default({}),
    paths: z.record(z.record(z.unknown())).default({})
  })
  .passthrough();

export type OpenApiDocument = z.infer<typeof openApiSchema>;

const PK_MARK = /<pk\/>/;
const FK_MARK = /<fk table='([^']+)' column='([^']+)'\/>/;

/** The description without PostgREST's "Note: This is a Primary Key.<pk/>" style markers. */
function cleanDescription(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/Note:\s*\n?This is a (Primary|Foreign) Key[^<]*<[^>]*\/>/g, "")
    .replace(/<pk\/>|<fk [^>]*\/>/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 2000) : null;
}

function toColumn(name: string, prop: z.infer<typeof propertySchema>, required: Set<string>) {
  const declared = prop.format ?? prop.type ?? "text";
  const arrayFromItems = prop.type === "array" && !declared.endsWith("[]");
  const { base, isList } = arrayFromItems
    ? { base: prop.items?.format ?? prop.items?.type ?? "text", isList: true }
    : splitArrayType(declared);
  const fk = prop.description ? FK_MARK.exec(prop.description) : null;
  const enumValues = prop.enum?.filter((v): v is string => typeof v === "string") ?? null;
  const column: SupabaseColumn = {
    name,
    pgType: isList ? `${base}[]` : base,
    type: nextomicTypeOf(base),
    isList,
    nullable: !required.has(name),
    primaryKey: prop.description ? PK_MARK.test(prop.description) : false,
    references: fk ? `${fk[1]}.${fk[2]}` : null,
    enumValues: enumValues && enumValues.length > 0 ? enumValues.slice(0, 500) : null,
    hasDefault: prop.default !== undefined,
    description: cleanDescription(prop.description)
  };
  return column;
}

const WRITE_METHODS = { post: "insert", patch: "update", delete: "delete" } as const;

/** Tables and views: a path with no write method is treated as a view (read only for this key). */
export function readTables(doc: OpenApiDocument): SupabaseTable[] {
  const tables: SupabaseTable[] = [];
  for (const [name, definition] of Object.entries(doc.definitions)) {
    const path = doc.paths[`/${name}`];
    if (!path) continue;
    const required = new Set(definition.required ?? []);
    const columns = Object.entries(definition.properties ?? {}).map(([col, prop]) =>
      toColumn(col, prop, required)
    );
    const operations: SupabaseTable["operations"] = [];
    if ("get" in path) operations.push("select");
    for (const [method, op] of Object.entries(WRITE_METHODS))
      if (method in path) operations.push(op);
    tables.push({
      name,
      kind: operations.length > 1 ? "table" : "view",
      description: cleanDescription(definition.description),
      columns,
      operations
    });
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

/** Database functions exposed as `/rpc/<name>`, with the parameters of their POST body. */
export function readFunctions(doc: OpenApiDocument): SupabaseFunction[] {
  const functions: SupabaseFunction[] = [];
  for (const [path, methods] of Object.entries(doc.paths)) {
    if (!path.startsWith("/rpc/")) continue;
    const name = path.slice(5);
    if (!name) continue;
    const post = operationSchema.safeParse(methods.post ?? methods.get);
    const params: SupabaseFunction["params"] = [];
    for (const raw of post.success ? (post.data.parameters ?? []) : []) {
      const parameter = parameterSchema.safeParse(raw);
      if (!parameter.success) continue;
      const body = parameter.data.schema?.properties;
      if (parameter.data.in === "body" && body) {
        for (const [paramName, prop] of Object.entries(body))
          params.push({ name: paramName, pgType: prop.format ?? prop.type ?? "text" });
      } else if (parameter.data.in === "query" && parameter.data.name) {
        params.push({ name: parameter.data.name, pgType: parameter.data.format ?? "text" });
      }
    }
    functions.push({ name, params });
  }
  return functions.sort((a, b) => a.name.localeCompare(b.name));
}
