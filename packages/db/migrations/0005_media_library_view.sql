-- A library row points at its file in Supabase Storage. Name, type, size and ETag are not copied
-- into the row: media_library reads them from storage.objects. Deleting the file (for example in
-- Studio) removes the library row with it.
ALTER TABLE "nextomic_builder"."media_assets"
  ADD CONSTRAINT "media_assets_object_id_fkey"
  FOREIGN KEY ("object_id") REFERENCES storage.objects ("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE VIEW "nextomic_builder"."media_library" WITH (security_invoker = true) AS
SELECT
  a."id",
  a."project_id",
  a."folder_id",
  a."object_id",
  a."title",
  a."alt",
  a."caption",
  a."tags",
  a."width",
  a."height",
  a."replaced_at",
  a."trashed_at",
  a."created_by",
  a."created_at",
  a."updated_at",
  o."name" AS "object_name",
  regexp_replace(o."name", '^.*/', '') AS "file_name",
  coalesce(o."metadata"->>'mimetype', 'application/octet-stream') AS "mime",
  coalesce((o."metadata"->>'size')::integer, 0) AS "size",
  trim(both '"' from coalesce(o."metadata"->>'eTag', '')) AS "hash"
FROM "nextomic_builder"."media_assets" a
JOIN storage.objects o ON o."id" = a."object_id";--> statement-breakpoint
REVOKE ALL ON "nextomic_builder"."media_library" FROM anon, authenticated;
