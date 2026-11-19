import type {
  ActionBlock,
  ElementNode,
  PageSettings,
  ProjectSettings,
  PublishedPage,
  PublishedTemplate,
  TemplateSettings,
  TriggerFlow
} from "@nextomic/schema";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

/**
 * Two schemas, by who may reach them:
 * - `public`: the account profile (`users`) and its backend-controlled companion (`user_meta`).
 *   They are reachable through the Supabase REST API once the owner turns that on per table. Row
 *   level security is enabled with no policies, so nothing is readable until the owner writes some.
 * - `nextomic_builder`: everything else the builder stores. Never exposed through REST.
 *
 * Ids: a uuid primary key where the id appears in a URL or in saved JSON, a bigint identity where
 * the row is internal. Rows that belong to a person point at `users.user_uid` (the Supabase auth id).
 */

// ---------------------------------------------------------------------------------------------
// public: account profile
// ---------------------------------------------------------------------------------------------

export const genderEnum = pgEnum("gender", ["Male", "Female", "Prefer Not To Say"]);
export const platformRoleEnum = pgEnum("platform_role", [
  "Admin",
  "Developer",
  "Senior Marketer",
  "Junior Marketer",
  "Affiliate Scout",
  "Customer"
]);
export const accountStatusEnum = pgEnum("account_status", ["Good", "Warning", "Suspended"]);

/**
 * One row per Supabase auth account, created by the `handle_new_user` trigger on `auth.users`.
 * Add profile columns freely: the builder reads only the columns it knows. A new NOT NULL column
 * needs a default, because the trigger creates the row.
 */
export const users = pgTable(
  "users",
  {
    userId: bigint("user_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    userUid: uuid("user_uid")
      .notNull()
      .references(() => authUsers.id, { onUpdate: "cascade", onDelete: "cascade" }),
    email: text("email").notNull(),
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    gender: genderEnum("gender"),
    country: text("country"),
    profession: text("profession"),
    userImage: text("user_image"),
    updatedOn: timestamp("updated_on", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("users_user_uid_key").on(table.userUid),
    unique("users_email_key").on(table.email),
    unique("users_phone_key").on(table.phone)
  ]
).enableRLS();

/** Set by the backend only. The signed-in person may read their own row, never change it. */
export const userMeta = pgTable(
  "user_meta",
  {
    metaId: bigint("meta_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.userId, { onUpdate: "cascade", onDelete: "cascade" }),
    role: platformRoleEnum("role").notNull().default("Customer"),
    accountStatus: accountStatusEnum("account_status").notNull().default("Good"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [unique("user_meta_user_id_key").on(table.userId)]
).enableRLS();

// ---------------------------------------------------------------------------------------------
// nextomic_builder: the builder's own data
// ---------------------------------------------------------------------------------------------

export const builderSchema = pgSchema("nextomic_builder");

export const workspaceRoleEnum = builderSchema.enum("workspace_role", [
  "owner",
  "editor",
  "member",
  "viewer"
]);
export const projectRoleEnum = builderSchema.enum("project_role", [
  "owner",
  "editor",
  "designer",
  "content_editor",
  "viewer"
]);
export const colorModeEnum = builderSchema.enum("color_mode", ["dark", "light", "system"]);
/** The IANA top-level media types, plus `other` for anything unlisted. SVG is image/svg+xml. */
export const MEDIA_KINDS = [
  "application",
  "audio",
  "font",
  "haptics",
  "image",
  "message",
  "model",
  "multipart",
  "text",
  "video",
  "other"
] as const;
export const mediaKindEnum = builderSchema.enum("media_kind", MEDIA_KINDS);
export const connectorTypeEnum = builderSchema.enum("connector_type", ["supabase", "rest"]);
/** What a proxied connector call did: check the connection, list resources, or run a request. */
export const connectorOperationEnum = builderSchema.enum("connector_operation", [
  "test",
  "resources",
  "execute"
]);
export const templateTypeEnum = builderSchema.enum("template_type", [
  "header",
  "footer",
  "error",
  "modal",
  "bottom-sheet",
  "section"
]);

export const workspaces = builderSchema.table("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const workspaceMembers = builderSchema.table(
  "workspace_members",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onUpdate: "cascade", onDelete: "cascade" }),
    userUid: uuid("user_uid")
      .notNull()
      .references(() => users.userUid, { onUpdate: "cascade", onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("workspace_members_workspace_user_key").on(table.workspaceId, table.userUid),
    // Deleting a user finds their memberships without scanning the table.
    index("workspace_members_user_idx").on(table.userUid)
  ]
);

export const projects = builderSchema.table(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onUpdate: "cascade", onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.userUid, { onUpdate: "cascade", onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }).notNull().defaultNow(),
    // Breakpoints and the element-ID toggle. null = defaults (see defaultProjectSettings).
    settings: jsonb("settings").$type<ProjectSettings>(),
    // Set by Publish, cleared by Unpublish. Visitors only ever see the published snapshots, never the draft.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedSettings: jsonb("published_settings").$type<ProjectSettings>(),
    // A publish set to run later. The first read after this moment publishes the saved draft.
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
    // Action Blocks as they were at the last publish.
    publishedActionBlocks: jsonb("published_action_blocks").$type<ActionBlock[]>()
  },
  (table) => [
    index("projects_workspace_idx").on(table.workspaceId),
    index("projects_created_by_idx").on(table.createdBy)
  ]
);

export const pages = builderSchema.table(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    name: text("name").notNull(),
    route: text("route").notNull(),
    settings: jsonb("settings").$type<PageSettings>().notNull(),
    tree: jsonb("tree").$type<ElementNode>().notNull(),
    // Incremented on every save; saves send the base version and a mismatch is a conflict.
    version: integer("version").notNull().default(1),
    publishedSnapshot: jsonb("published_snapshot").$type<PublishedPage>(),
    createdBy: uuid("created_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    // When this page last went live; cleared by Unpublish.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // When its screenshot was last generated (the file lives in storage at a fixed key).
    screenshotAt: timestamp("screenshot_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("pages_project_route_idx").on(table.projectId, table.route),
    index("pages_created_by_idx").on(table.createdBy)
  ]
);

export const templates = builderSchema.table(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    type: templateTypeEnum("type").notNull(),
    name: text("name").notNull(),
    settings: jsonb("settings").$type<TemplateSettings>().notNull(),
    tree: jsonb("tree").$type<ElementNode>().notNull(),
    // Incremented on every save; saves send the base version and a mismatch is a conflict.
    version: integer("version").notNull().default(1),
    publishedSnapshot: jsonb("published_snapshot").$type<PublishedTemplate>(),
    createdBy: uuid("created_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    screenshotAt: timestamp("screenshot_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("templates_project_idx").on(table.projectId, table.type),
    index("templates_created_by_idx").on(table.createdBy)
  ]
);

// Media library. One row per uploaded file; the bytes live in storage under
// `media/<projectId>/<id>/<fileName>`. Trashed rows keep serving until purged.
export const mediaFolders = builderSchema.table(
  "media_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("media_folders_project_name_idx").on(table.projectId, table.name)]
);

export const mediaAssets = builderSchema.table(
  "media_assets",
  {
    // The id is part of the public path.
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => mediaFolders.id, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    // Empty until someone names the file; the library then shows the original name.
    title: text("title").notNull().default(""),
    originalName: text("original_name").notNull(),
    fileName: text("file_name").notNull(),
    kind: mediaKindEnum("kind").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    // SHA-256 of the stored bytes; the public route's ETag.
    hash: text("hash").notNull(),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("media_assets_project_idx").on(table.projectId, table.createdAt),
    index("media_assets_folder_idx").on(table.folderId),
    index("media_assets_created_by_idx").on(table.createdBy)
  ]
);

export const pageVersions = builderSchema.table(
  "page_versions",
  {
    // Nothing refers to a version row, so a sequential number beats a uuid here.
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onUpdate: "cascade", onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    route: text("route").notNull(),
    settings: jsonb("settings").$type<PageSettings>().notNull(),
    tree: jsonb("tree").$type<ElementNode>().notNull(),
    savedBy: uuid("saved_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("page_versions_page_version_idx").on(table.pageId, table.version),
    index("page_versions_page_created_idx").on(table.pageId, table.createdAt),
    index("page_versions_saved_by_idx").on(table.savedBy)
  ]
);

// Action flows of one element, saved apart from the page tree (the flow editor saves on its own).
// Exactly one of pageId / templateId is set; rows go with their page or template.
export const actionFlows = builderSchema.table(
  "action_flows",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, {
      onUpdate: "cascade",
      onDelete: "cascade"
    }),
    templateId: uuid("template_id").references(() => templates.id, {
      onUpdate: "cascade",
      onDelete: "cascade"
    }),
    nodeId: text("node_id").notNull(),
    flows: jsonb("flows").$type<TriggerFlow[]>().notNull(),
    // Incremented on every save; a save with an older base version is a conflict.
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("action_flows_page_node_idx").on(table.pageId, table.nodeId),
    uniqueIndex("action_flows_template_node_idx").on(table.templateId, table.nodeId),
    index("action_flows_project_idx").on(table.projectId),
    index("action_flows_updated_by_idx").on(table.updatedBy),
    check("action_flows_one_owner", sql`(${table.pageId} is null) <> (${table.templateId} is null)`)
  ]
);

// Reusable flows of a project. Editing one changes every call. The id is saved inside flows.
export const actionBlocks = builderSchema.table(
  "action_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    block: jsonb("block").$type<ActionBlock>().notNull(),
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("action_blocks_project_idx").on(table.projectId),
    index("action_blocks_updated_by_idx").on(table.updatedBy)
  ]
);

export const userPreferences = builderSchema.table("user_preferences", {
  userUid: uuid("user_uid")
    .primaryKey()
    .references(() => users.userUid, { onUpdate: "cascade", onDelete: "cascade" }),
  colorMode: colorModeEnum("color_mode").notNull().default("dark")
});

// Connectors of BUILT apps (Supabase, REST). Config is plain JSON; secrets are one AES-256-GCM
// sealed JSON object (see packages/integrations/src/secrets.ts), null when there are none.
export const connectors = builderSchema.table(
  "connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onUpdate: "cascade", onDelete: "cascade" }),
    type: connectorTypeEnum("type").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(false),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    secretCiphertext: text("secret_ciphertext"),
    secretIv: text("secret_iv"),
    secretTag: text("secret_tag"),
    keyVersion: integer("key_version"),
    createdBy: uuid("created_by").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("connectors_project_name_idx").on(table.projectId, table.name),
    index("connectors_created_by_idx").on(table.createdBy)
  ]
);

// The saved STRUCTURE of a connected source (tables, columns, buckets, response shapes). Never rows.
export const connectorSchemas = builderSchema.table("connector_schemas", {
  connectorId: uuid("connector_id")
    .primaryKey()
    .references(() => connectors.id, { onUpdate: "cascade", onDelete: "cascade" }),
  structure: jsonb("structure").$type<unknown>().notNull(),
  hash: text("hash").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow()
});

// One row per proxied connector call: who, what and how it went. No bodies, no secrets.
export const connectorAuditLog = builderSchema.table(
  "connector_audit_log",
  {
    // Nothing refers to a log row, so a small sequential number beats a uuid here.
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => connectors.id, { onUpdate: "cascade", onDelete: "cascade" }),
    userUid: uuid("user_uid").references(() => users.userUid, {
      onUpdate: "cascade",
      onDelete: "set null"
    }),
    operation: connectorOperationEnum("operation").notNull(),
    resourceId: text("resource_id"),
    status: text("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("connector_audit_connector_idx").on(table.connectorId, table.createdAt),
    index("connector_audit_user_idx").on(table.userUid)
  ]
);

export type MediaKindValue = (typeof MEDIA_KINDS)[number];

/** SQL for a person's display name: first and last name, or the part of the email before the @. */
export const userDisplayName = sql<string>`coalesce(nullif(trim(concat_ws(' ', ${users.firstName}, ${users.lastName})), ''), split_part(${users.email}, '@', 1))`;
