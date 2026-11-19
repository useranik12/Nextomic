CREATE SCHEMA IF NOT EXISTS "nextomic_builder";
--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('Good', 'Warning', 'Suspended');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."color_mode" AS ENUM('dark', 'light', 'system');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."connector_operation" AS ENUM('test', 'resources', 'execute');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."connector_type" AS ENUM('supabase', 'rest');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('Male', 'Female', 'Prefer Not To Say');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."media_kind" AS ENUM('application', 'audio', 'font', 'haptics', 'image', 'message', 'model', 'multipart', 'text', 'video', 'other');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('Admin', 'Developer', 'Senior Marketer', 'Junior Marketer', 'Affiliate Scout', 'Customer');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."project_role" AS ENUM('owner', 'editor', 'designer', 'content_editor', 'viewer');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."template_type" AS ENUM('header', 'footer', 'error', 'modal', 'bottom-sheet', 'section');--> statement-breakpoint
CREATE TYPE "nextomic_builder"."workspace_role" AS ENUM('owner', 'editor', 'member', 'viewer');--> statement-breakpoint
CREATE TABLE "nextomic_builder"."action_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"block" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."action_flows" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nextomic_builder"."action_flows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"page_id" uuid,
	"template_id" uuid,
	"node_id" text NOT NULL,
	"flows" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_flows_one_owner" CHECK (("nextomic_builder"."action_flows"."page_id" is null) <> ("nextomic_builder"."action_flows"."template_id" is null))
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."connector_audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nextomic_builder"."connector_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"connector_id" uuid NOT NULL,
	"user_uid" uuid,
	"operation" "nextomic_builder"."connector_operation" NOT NULL,
	"resource_id" text,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."connector_schemas" (
	"connector_id" uuid PRIMARY KEY NOT NULL,
	"structure" jsonb NOT NULL,
	"hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "nextomic_builder"."connector_type" NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"secret_ciphertext" text,
	"secret_iv" text,
	"secret_tag" text,
	"key_version" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"folder_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"original_name" text NOT NULL,
	"file_name" text NOT NULL,
	"kind" "nextomic_builder"."media_kind" NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hash" text NOT NULL,
	"replaced_at" timestamp with time zone,
	"trashed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."page_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nextomic_builder"."page_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"settings" jsonb NOT NULL,
	"tree" jsonb NOT NULL,
	"saved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"settings" jsonb NOT NULL,
	"tree" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_snapshot" jsonb,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"screenshot_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settings" jsonb,
	"published_at" timestamp with time zone,
	"published_settings" jsonb,
	"scheduled_publish_at" timestamp with time zone,
	"published_action_blocks" jsonb
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "nextomic_builder"."template_type" NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb NOT NULL,
	"tree" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_snapshot" jsonb,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"screenshot_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_meta" (
	"meta_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_meta_meta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" bigint NOT NULL,
	"role" "platform_role" DEFAULT 'Customer' NOT NULL,
	"account_status" "account_status" DEFAULT 'Good' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_meta_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_meta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nextomic_builder"."user_preferences" (
	"user_uid" uuid PRIMARY KEY NOT NULL,
	"color_mode" "nextomic_builder"."color_mode" DEFAULT 'dark' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_uid" uuid NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"gender" "gender",
	"country" text,
	"profession" text,
	"user_image" text,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_user_uid_key" UNIQUE("user_uid"),
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_phone_key" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nextomic_builder"."workspace_members" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nextomic_builder"."workspace_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" uuid NOT NULL,
	"user_uid" uuid NOT NULL,
	"role" "nextomic_builder"."workspace_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_user_key" UNIQUE("workspace_id","user_uid")
);
--> statement-breakpoint
CREATE TABLE "nextomic_builder"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nextomic_builder"."action_blocks" ADD CONSTRAINT "action_blocks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."action_blocks" ADD CONSTRAINT "action_blocks_updated_by_users_user_uid_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."action_flows" ADD CONSTRAINT "action_flows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."action_flows" ADD CONSTRAINT "action_flows_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "nextomic_builder"."pages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."action_flows" ADD CONSTRAINT "action_flows_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "nextomic_builder"."templates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."action_flows" ADD CONSTRAINT "action_flows_updated_by_users_user_uid_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."connector_audit_log" ADD CONSTRAINT "connector_audit_log_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "nextomic_builder"."connectors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."connector_audit_log" ADD CONSTRAINT "connector_audit_log_user_uid_users_user_uid_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."connector_schemas" ADD CONSTRAINT "connector_schemas_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "nextomic_builder"."connectors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."connectors" ADD CONSTRAINT "connectors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."connectors" ADD CONSTRAINT "connectors_created_by_users_user_uid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" ADD CONSTRAINT "media_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" ADD CONSTRAINT "media_assets_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "nextomic_builder"."media_folders"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" ADD CONSTRAINT "media_assets_created_by_users_user_uid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_folders" ADD CONSTRAINT "media_folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "nextomic_builder"."pages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."page_versions" ADD CONSTRAINT "page_versions_saved_by_users_user_uid_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."pages" ADD CONSTRAINT "pages_created_by_users_user_uid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "nextomic_builder"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."projects" ADD CONSTRAINT "projects_created_by_users_user_uid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_uid") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."templates" ADD CONSTRAINT "templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "nextomic_builder"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."templates" ADD CONSTRAINT "templates_created_by_users_user_uid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_uid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_meta" ADD CONSTRAINT "user_meta_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."user_preferences" ADD CONSTRAINT "user_preferences_user_uid_users_user_uid_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."users"("user_uid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_user_uid_users_id_fk" FOREIGN KEY ("user_uid") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "nextomic_builder"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nextomic_builder"."workspace_members" ADD CONSTRAINT "workspace_members_user_uid_users_user_uid_fk" FOREIGN KEY ("user_uid") REFERENCES "public"."users"("user_uid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "action_blocks_project_idx" ON "nextomic_builder"."action_blocks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "action_blocks_updated_by_idx" ON "nextomic_builder"."action_blocks" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "action_flows_page_node_idx" ON "nextomic_builder"."action_flows" USING btree ("page_id","node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_flows_template_node_idx" ON "nextomic_builder"."action_flows" USING btree ("template_id","node_id");--> statement-breakpoint
CREATE INDEX "action_flows_project_idx" ON "nextomic_builder"."action_flows" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "action_flows_updated_by_idx" ON "nextomic_builder"."action_flows" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "connector_audit_connector_idx" ON "nextomic_builder"."connector_audit_log" USING btree ("connector_id","created_at");--> statement-breakpoint
CREATE INDEX "connector_audit_user_idx" ON "nextomic_builder"."connector_audit_log" USING btree ("user_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_project_name_idx" ON "nextomic_builder"."connectors" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "connectors_created_by_idx" ON "nextomic_builder"."connectors" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "media_assets_project_idx" ON "nextomic_builder"."media_assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "media_assets_folder_idx" ON "nextomic_builder"."media_assets" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "media_assets_created_by_idx" ON "nextomic_builder"."media_assets" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "media_folders_project_name_idx" ON "nextomic_builder"."media_folders" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "page_versions_page_version_idx" ON "nextomic_builder"."page_versions" USING btree ("page_id","version");--> statement-breakpoint
CREATE INDEX "page_versions_page_created_idx" ON "nextomic_builder"."page_versions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "page_versions_saved_by_idx" ON "nextomic_builder"."page_versions" USING btree ("saved_by");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_project_route_idx" ON "nextomic_builder"."pages" USING btree ("project_id","route");--> statement-breakpoint
CREATE INDEX "pages_created_by_idx" ON "nextomic_builder"."pages" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "nextomic_builder"."projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_created_by_idx" ON "nextomic_builder"."projects" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "templates_project_idx" ON "nextomic_builder"."templates" USING btree ("project_id","type");--> statement-breakpoint
CREATE INDEX "templates_created_by_idx" ON "nextomic_builder"."templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "nextomic_builder"."workspace_members" USING btree ("user_uid");