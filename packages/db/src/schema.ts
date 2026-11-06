import type {
  ElementNode,
  PageSettings,
  ProjectSettings,
  PublishedPage,
  PublishedTemplate,
  TemplateSettings
} from "@nextomic/schema";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "admin", "member"]);
export const colorModeEnum = pgEnum("color_mode", ["dark", "light", "system"]);

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })]
);

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }).notNull().defaultNow(),
  // Breakpoints and the element-ID toggle. null = defaults (see defaultProjectSettings).
  settings: jsonb("settings").$type<ProjectSettings>(),
  // Set by Publish, cleared by Unpublish. Visitors only ever see the published snapshots, never the draft.
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedSettings: jsonb("published_settings").$type<ProjectSettings>()
});

export const pages = pgTable(
  "pages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    route: text("route").notNull(),
    settings: jsonb("settings").$type<PageSettings>().notNull(),
    tree: jsonb("tree").$type<ElementNode>().notNull(),
    // Incremented on every save; saves send the base version and a mismatch is a conflict.
    version: integer("version").notNull().default(1),
    publishedSnapshot: jsonb("published_snapshot").$type<PublishedPage>(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    // When this page last went live; cleared by Unpublish.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // When its screenshot was last generated (the file lives in storage at a fixed key).
    screenshotAt: timestamp("screenshot_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("pages_project_route_idx").on(table.projectId, table.route)]
);

export const templates = pgTable(
  "templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").$type<"header" | "footer" | "error-404">().notNull(),
    name: text("name").notNull(),
    settings: jsonb("settings").$type<TemplateSettings>().notNull(),
    tree: jsonb("tree").$type<ElementNode>().notNull(),
    // Incremented on every save; saves send the base version and a mismatch is a conflict.
    version: integer("version").notNull().default(1),
    publishedSnapshot: jsonb("published_snapshot").$type<PublishedTemplate>(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    screenshotAt: timestamp("screenshot_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("templates_project_idx").on(table.projectId, table.type)]
);

export const pageVersions = pgTable(
  "page_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    route: text("route").notNull(),
    settings: jsonb("settings").$type<PageSettings>().notNull(),
    tree: jsonb("tree").$type<ElementNode>().notNull(),
    savedBy: text("saved_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("page_versions_page_version_idx").on(table.pageId, table.version),
    index("page_versions_page_created_idx").on(table.pageId, table.createdAt)
  ]
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  colorMode: colorModeEnum("color_mode").notNull().default("dark")
});
