ALTER TABLE "pages" ADD COLUMN "published_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "published_settings" jsonb;