CREATE TABLE "nextomic_builder"."storage_deletions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nextomic_builder"."storage_deletions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bucket" text NOT NULL,
	"prefix" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "storage_deletions_folder_key" ON "nextomic_builder"."storage_deletions" USING btree ("bucket","prefix");
--> statement-breakpoint
REVOKE ALL ON "nextomic_builder"."storage_deletions" FROM anon, authenticated;
--> statement-breakpoint
-- The three private buckets the builder uses. Files are served only through the builder, so none is
-- public. Size limits sit under the Storage service's global FILE_SIZE_LIMIT, which must be at least
-- 200 MB (the largest video the media library accepts).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('nextomic-builder-assets', 'nextomic-builder-assets', false, 52428800),
  ('customer-data', 'customer-data', false, 5242880),
  ('app-uploads', 'app-uploads', false, 209715200)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;
--> statement-breakpoint
-- When a user, workspace or project row is deleted, queue the matching storage folder for emptying.
-- Files themselves are removed by the builder through the Storage API (deleting storage.objects rows
-- with SQL would leave the files behind). Project and workspace deletes can cascade; duplicate queue
-- rows are ignored.
CREATE OR REPLACE FUNCTION nextomic_builder.queue_storage_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    INSERT INTO nextomic_builder.storage_deletions (bucket, prefix)
    VALUES ('customer-data', OLD.user_uid::text || '/')
    ON CONFLICT DO NOTHING;
  ELSIF TG_TABLE_NAME = 'workspaces' THEN
    INSERT INTO nextomic_builder.storage_deletions (bucket, prefix)
    VALUES ('app-uploads', OLD.id::text || '/')
    ON CONFLICT DO NOTHING;
  ELSIF TG_TABLE_NAME = 'projects' THEN
    INSERT INTO nextomic_builder.storage_deletions (bucket, prefix)
    VALUES ('app-uploads', OLD.workspace_id::text || '/' || OLD.id::text || '/')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER queue_user_storage_deletion
AFTER DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION nextomic_builder.queue_storage_deletion();
--> statement-breakpoint
CREATE TRIGGER queue_workspace_storage_deletion
AFTER DELETE ON nextomic_builder.workspaces
FOR EACH ROW EXECUTE FUNCTION nextomic_builder.queue_storage_deletion();
--> statement-breakpoint
CREATE TRIGGER queue_project_storage_deletion
AFTER DELETE ON nextomic_builder.projects
FOR EACH ROW EXECUTE FUNCTION nextomic_builder.queue_storage_deletion();
