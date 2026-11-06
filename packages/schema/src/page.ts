import { layoutChoiceSchema } from "./template";
import { z } from "zod";
import { elementNodeSchema, type ElementNode } from "./element";
import { propValueSchema } from "./value";

export const pageVariableTypeSchema = z.enum([
  "string",
  "integer",
  "float",
  "boolean",
  "datetime",
  "date",
  "time",
  "color",
  "url",
  "json",
  "enum"
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const pageParamSchema = z.object({
  name: z.string().regex(IDENTIFIER).max(64),
  type: pageVariableTypeSchema.default("string"),
  required: z.boolean().default(false),
  defaultValue: z.string().max(500).default("")
});

export const pageStateVariableSchema = z.object({
  name: z.string().regex(IDENTIFIER).max(64),
  type: pageVariableTypeSchema,
  isList: z.boolean().default(false),
  defaultValue: propValueSchema.optional(),
  enumOptions: z.array(z.string()).optional(),
  description: z.string().max(300).optional()
});

export const ROUTE_PATTERN = /^\/([a-z0-9._~-]+(\/[a-z0-9._~-]+)*)?$/i;

export const pageRouteSchema = z.string().max(300).regex(ROUTE_PATTERN, "Use a path like /about");

const safeUrlField = z
  .string()
  .max(500)
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
    "Use an http(s) URL or a path starting with /"
  );

export const pageSeoSchema = z.object({
  title: z.string().max(120).default(""),
  description: z.string().max(300).default(""),
  canonical: safeUrlField.default(""),
  robots: z.enum(["index", "noindex"]).default("index"),
  ogTitle: z.string().max(120).default(""),
  ogDescription: z.string().max(300).default(""),
  ogImage: safeUrlField.default("")
});
export type PageSeo = z.infer<typeof pageSeoSchema>;

export const pageSettingsSchema = z.object({
  seo: pageSeoSchema.default({}),
  locale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "Use a language code like en or en-US")
    .default("en"),
  description: z.string().max(500).default(""),
  includeInPublish: z.boolean().default(true),
  isHome: z.boolean().default(false),
  requiresAuth: z.boolean().default(false),
  // Forced theme id; null means Auto (conditions, then the default theme).
  themeId: z.string().max(64).nullable().default(null),
  // Keep a version history for this page (needs version control on in App Settings).
  versionControl: z.boolean().default(true),
  // Snapshots kept for this page (5 to 200); null follows the app-wide limit.
  versionLimit: z.number().int().min(5).max(200).nullable().default(null),
  // Header and footer: "auto" (rules decide), "none", or the id of one template.
  header: layoutChoiceSchema,
  footer: layoutChoiceSchema,
  // Marking: ids of page categories and page tags (the lists live in the project settings).
  categoryIds: z.array(z.string().max(64)).max(50).default([]),
  tagIds: z.array(z.string().max(64)).max(50).default([]),
  params: z.array(pageParamSchema).max(20).default([]),
  state: z.array(pageStateVariableSchema).max(100).default([])
});
export type PageSettings = z.infer<typeof pageSettingsSchema>;

export const pageNameSchema = z.string().trim().min(1).max(100);

export const createPageInputSchema = z.object({
  name: pageNameSchema,
  route: pageRouteSchema
});
export type CreatePageInput = z.infer<typeof createPageInputSchema>;

export const pageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: pageNameSchema,
  route: pageRouteSchema,
  settings: pageSettingsSchema,
  tree: elementNodeSchema,
  version: z.number().int().min(1),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Page = z.infer<typeof pageSchema>;

export const savePageInputSchema = z.object({
  baseVersion: z.number().int().min(1),
  name: pageNameSchema.optional(),
  route: pageRouteSchema.optional(),
  settings: pageSettingsSchema.optional(),
  tree: elementNodeSchema.optional()
});
export type SavePageInput = z.infer<typeof savePageInputSchema>;

export function emptyPageTree(): ElementNode {
  return {
    id: crypto.randomUUID(),
    type: "page",
    name: "Page",
    classIds: [],
    props: {},
    styles: { breakpoints: {} },
    actions: {},
    children: []
  };
}

export function defaultPageSettings(): PageSettings {
  return pageSettingsSchema.parse({});
}

/** What a visitor sees: the page as it was when the project was published. */
export type PublishedPage = Pick<Page, "name" | "route" | "settings" | "tree">;
