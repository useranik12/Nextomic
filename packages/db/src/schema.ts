import type {
  ElementNode,
  PageSettings,
  ProjectSettings,
  PublishedPage,
  PublishedTemplate,
  TemplateSettings
} from "@nextomic/schema";
import {
  boolean,
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
  publishedSettings: jsonb("published_settings").$type<ProjectSettings>(),
  // A publish set to run later. The first read after this moment publishes the saved draft.
  scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true })
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

// Connectors of BUILT apps (Supabase, REST). Config is plain JSON; secrets are one AES-256-GCM
// sealed JSON object (see packages/integrations/src/secrets.ts), null when there are none.
export const connectors = pgTable(
  "connectors",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").$type<"supabase" | "rest">().notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(false),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    secretCiphertext: text("secret_ciphertext"),
    secretIv: text("secret_iv"),
    secretTag: text("secret_tag"),
    keyVersion: integer("key_version"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("connectors_project_name_idx").on(table.projectId, table.name)]
);

// The saved STRUCTURE of a connected source (tables, columns, buckets, response shapes). Never rows.
export const connectorSchemas = pgTable("connector_schemas", {
  connectorId: text("connector_id")
    .primaryKey()
    .references(() => connectors.id, { onDelete: "cascade" }),
  structure: jsonb("structure").$type<unknown>().notNull(),
  hash: text("hash").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow()
});

// One row per proxied connector call: who, what and how it went. No bodies, no secrets.
export const connectorAuditLog = pgTable(
  "connector_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    operation: text("operation").$type<"test" | "resources" | "execute">().notNull(),
    resourceId: text("resource_id"),
    status: text("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("connector_audit_connector_idx").on(table.connectorId, table.createdAt)]
);

// Builder SMTP accounts (docs/platform.md section 4). Platform-wide, managed by workspace owners
// and admins. The password is AES-256-GCM sealed like connector secrets; the row id is bound in.
export const smtpAccounts = pgTable(
  "smtp_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    host: text("host").notNull(),
    port: integer("port").notNull(),
    security: text("security").$type<"tls" | "starttls" | "none">().notNull(),
    username: text("username"),
    passwordCiphertext: text("password_ciphertext"),
    passwordIv: text("password_iv"),
    passwordTag: text("password_tag"),
    keyVersion: integer("key_version"),
    fromName: text("from_name").notNull(),
    fromAddress: text("from_address").notNull(),
    replyTo: text("reply_to"),
    // Messages per minute this account may send; null = no limit.
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("smtp_accounts_name_idx").on(table.name)]
);

export type EmailKind = "verify-email" | "reset-password" | "test";

// Edited platform email templates. A kind without a row uses the built-in default.
export const emailTemplates = pgTable("email_templates", {
  kind: text("kind").$type<EmailKind>().primaryKey(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

// The outgoing mail queue and its log. Bodies are kept only until the message is sent or gives
// up, then cleared, so the log holds who, what kind, when and how it went, never the content.
export const emailQueue = pgTable(
  "email_queue",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kind: text("kind").$type<EmailKind>().notNull(),
    // An smtp_accounts id, "env" for the environment account, or null for the default.
    accountId: text("account_id"),
    // The account that actually sent (or last tried) it, for the log.
    sentWith: text("sent_with"),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    status: text("status").$type<"queued" | "sending" | "sent" | "failed">().notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true })
  },
  (table) => [
    index("email_queue_due_idx").on(table.status, table.nextAttemptAt),
    index("email_queue_sent_idx").on(table.sentWith, table.sentAt)
  ]
);
