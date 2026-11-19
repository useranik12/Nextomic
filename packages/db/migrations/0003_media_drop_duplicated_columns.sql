-- Media files now live at <workspace>/<project>/media-assets/<type>/<file> and the library row links
-- to its storage object (migration 0005). Old rows hold files at media-assets/<asset>/original, which
-- cannot be linked, so they are removed together with their storage folders (queued here, emptied by
-- the builder). This only affects test data from before the change.
INSERT INTO "nextomic_builder"."storage_deletions" ("bucket", "prefix")
SELECT DISTINCT 'app-uploads', p."workspace_id"::text || '/' || p."id"::text || '/media-assets/'
FROM "nextomic_builder"."media_assets" m
JOIN "nextomic_builder"."projects" p ON p."id" = m."project_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "nextomic_builder"."media_assets";--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" DROP COLUMN "original_name";--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" DROP COLUMN "file_name";--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" DROP COLUMN "mime";--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" DROP COLUMN "size";--> statement-breakpoint
ALTER TABLE "nextomic_builder"."media_assets" DROP COLUMN "hash";