CREATE INDEX "action_blocks_updated_by_idx" ON "action_blocks" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "action_flows_project_idx" ON "action_flows" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "action_flows_updated_by_idx" ON "action_flows" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "connector_audit_user_idx" ON "connector_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connectors_created_by_idx" ON "connectors" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "media_assets_folder_idx" ON "media_assets" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "media_assets_created_by_idx" ON "media_assets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "page_versions_saved_by_idx" ON "page_versions" USING btree ("saved_by");--> statement-breakpoint
CREATE INDEX "pages_created_by_idx" ON "pages" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_created_by_idx" ON "projects" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "templates_created_by_idx" ON "templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_user_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
-- History cap is now 50 per page: bring stored limits down and drop the older snapshots once.
UPDATE "projects" SET "settings" = jsonb_set("settings", '{versionLimit}', '50') WHERE jsonb_typeof("settings"->'versionLimit') = 'number' AND ("settings"->>'versionLimit')::numeric > 50;--> statement-breakpoint
UPDATE "projects" SET "published_settings" = jsonb_set("published_settings", '{versionLimit}', '50') WHERE jsonb_typeof("published_settings"->'versionLimit') = 'number' AND ("published_settings"->>'versionLimit')::numeric > 50;--> statement-breakpoint
UPDATE "pages" SET "settings" = jsonb_set("settings", '{versionLimit}', '50') WHERE jsonb_typeof("settings"->'versionLimit') = 'number' AND ("settings"->>'versionLimit')::numeric > 50;--> statement-breakpoint
UPDATE "page_versions" SET "settings" = jsonb_set("settings", '{versionLimit}', '50') WHERE jsonb_typeof("settings"->'versionLimit') = 'number' AND ("settings"->>'versionLimit')::numeric > 50;--> statement-breakpoint
DELETE FROM "page_versions" WHERE "id" IN (SELECT "id" FROM (SELECT "id", row_number() OVER (PARTITION BY "page_id" ORDER BY "version" DESC) AS "rn" FROM "page_versions") "ranked" WHERE "rn" > 50);
