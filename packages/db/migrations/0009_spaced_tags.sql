-- Dynamic tags need a space inside both braces ({{ tag }}); {{tag}} is now plain text
-- (owner decision 2026-11-09). Rewrites tags stored in the old form once, so they stay tags.
UPDATE "projects" SET "settings" = regexp_replace("settings"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "settings"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "projects" SET "published_settings" = regexp_replace("published_settings"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "published_settings"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "pages" SET "settings" = regexp_replace("settings"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "settings"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "pages" SET "tree" = regexp_replace("tree"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "tree"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "pages" SET "published_snapshot" = regexp_replace("published_snapshot"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "published_snapshot"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "templates" SET "settings" = regexp_replace("settings"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "settings"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "templates" SET "tree" = regexp_replace("tree"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "tree"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "templates" SET "published_snapshot" = regexp_replace("published_snapshot"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "published_snapshot"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "page_versions" SET "settings" = regexp_replace("settings"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "settings"::text ~ '\{\{';
--> statement-breakpoint
UPDATE "page_versions" SET "tree" = regexp_replace("tree"::text, '\{\{ *([^{}"]*?[^{} "]) *\}\}', '{{ \1 }}', 'g')::jsonb WHERE "tree"::text ~ '\{\{';
