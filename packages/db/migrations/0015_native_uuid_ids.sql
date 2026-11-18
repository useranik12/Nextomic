-- Native uuid keys (owner decision 2026-11-19, Supabase style: uuid columns with gen_random_uuid()).
-- Text ids that already are uuids are only re-typed. Better Auth's own 32-character ids cannot be cast,
-- so each user gets a new uuid and every reference (and a credential account's account_id, which Better
-- Auth keeps equal to the user id) is rewritten. Older 24-character media ids cannot be cast, so this
-- migration stops with a message if any media exist that are not uuids (nothing is lost: the deploy
-- fails before changing anything; delete those files or ask first).
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM media_assets WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'media_assets holds ids that are not uuids; remove or migrate those media files before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM media_folders WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'media_folders holds ids that are not uuids; remove them before this migration';
  END IF;
END $$;
--> statement-breakpoint
CREATE TEMP TABLE nxt_fk_saved AS SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
--> statement-breakpoint
DO $$ DECLARE r record; BEGIN FOR r IN SELECT tbl, conname FROM nxt_fk_saved LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname); END LOOP; END $$;
--> statement-breakpoint
CREATE TEMP TABLE nxt_user_ids AS SELECT id AS old_id, CASE WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id ELSE gen_random_uuid()::text END AS new_id FROM "user";
--> statement-breakpoint
UPDATE "session" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "session"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "account" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "account"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "two_factor" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "two_factor"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "passkey" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "passkey"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "workspace_members" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "workspace_members"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "user_preferences" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "user_preferences"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "projects" SET "created_by" = m.new_id FROM nxt_user_ids m WHERE "projects"."created_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "pages" SET "created_by" = m.new_id FROM nxt_user_ids m WHERE "pages"."created_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "page_versions" SET "saved_by" = m.new_id FROM nxt_user_ids m WHERE "page_versions"."saved_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "templates" SET "created_by" = m.new_id FROM nxt_user_ids m WHERE "templates"."created_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "media_assets" SET "created_by" = m.new_id FROM nxt_user_ids m WHERE "media_assets"."created_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "action_flows" SET "updated_by" = m.new_id FROM nxt_user_ids m WHERE "action_flows"."updated_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "action_blocks" SET "updated_by" = m.new_id FROM nxt_user_ids m WHERE "action_blocks"."updated_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "connectors" SET "created_by" = m.new_id FROM nxt_user_ids m WHERE "connectors"."created_by" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "connector_audit_log" SET "user_id" = m.new_id FROM nxt_user_ids m WHERE "connector_audit_log"."user_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "account" SET "account_id" = m.new_id FROM nxt_user_ids m WHERE "account"."provider_id" = 'credential' AND "account"."account_id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
-- Avatar files are stored under the old user id and cannot be renamed from SQL: the link is cleared (re-upload to set it again).
UPDATE "user" SET "image" = NULL FROM nxt_user_ids m WHERE "user"."id" = m.old_id AND m.old_id <> m.new_id AND "user"."image" LIKE '/avatars/%';
--> statement-breakpoint
UPDATE "user" SET "id" = m.new_id FROM nxt_user_ids m WHERE "user"."id" = m.old_id AND m.old_id <> m.new_id;
--> statement-breakpoint
UPDATE "session" SET "id" = gen_random_uuid()::text WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--> statement-breakpoint
UPDATE "account" SET "id" = gen_random_uuid()::text WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--> statement-breakpoint
UPDATE "verification" SET "id" = gen_random_uuid()::text WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--> statement-breakpoint
UPDATE "two_factor" SET "id" = gen_random_uuid()::text WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--> statement-breakpoint
UPDATE "passkey" SET "id" = gen_random_uuid()::text WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--> statement-breakpoint
ALTER TABLE "connector_audit_log" DROP CONSTRAINT IF EXISTS "connector_audit_log_pkey";
--> statement-breakpoint
ALTER TABLE "connector_audit_log" DROP COLUMN "id";
--> statement-breakpoint
ALTER TABLE "connector_audit_log" ADD COLUMN "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
--> statement-breakpoint
ALTER TABLE "action_blocks" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_blocks" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_blocks" ALTER COLUMN "updated_by" SET DATA TYPE uuid USING "updated_by"::uuid;
--> statement-breakpoint
ALTER TABLE "action_flows" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_flows" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_flows" ALTER COLUMN "page_id" SET DATA TYPE uuid USING "page_id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_flows" ALTER COLUMN "template_id" SET DATA TYPE uuid USING "template_id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_flows" ALTER COLUMN "updated_by" SET DATA TYPE uuid USING "updated_by"::uuid;
--> statement-breakpoint
ALTER TABLE "connector_audit_log" ALTER COLUMN "connector_id" SET DATA TYPE uuid USING "connector_id"::uuid;
--> statement-breakpoint
ALTER TABLE "connector_audit_log" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "connector_schemas" ALTER COLUMN "connector_id" SET DATA TYPE uuid USING "connector_id"::uuid;
--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "created_by"::uuid;
--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "folder_id" SET DATA TYPE uuid USING "folder_id"::uuid;
--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "created_by"::uuid;
--> statement-breakpoint
ALTER TABLE "media_folders" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "media_folders" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "page_versions" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "page_versions" ALTER COLUMN "page_id" SET DATA TYPE uuid USING "page_id"::uuid;
--> statement-breakpoint
ALTER TABLE "page_versions" ALTER COLUMN "saved_by" SET DATA TYPE uuid USING "saved_by"::uuid;
--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "created_by"::uuid;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET DATA TYPE uuid USING "workspace_id"::uuid;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "created_by"::uuid;
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "project_id" SET DATA TYPE uuid USING "project_id"::uuid;
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "created_by"::uuid;
--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "workspace_id" SET DATA TYPE uuid USING "workspace_id"::uuid;
--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "passkey" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "passkey" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "two_factor" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "two_factor" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
--> statement-breakpoint
ALTER TABLE "action_blocks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "action_flows" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "media_folders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "page_versions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "passkey" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "two_factor" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
DO $$ DECLARE r record; BEGIN FOR r IN SELECT tbl, conname, def FROM nxt_fk_saved LOOP EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.conname, r.def); END LOOP; END $$;
--> statement-breakpoint
DROP TABLE nxt_fk_saved;
--> statement-breakpoint
DROP TABLE nxt_user_ids;
