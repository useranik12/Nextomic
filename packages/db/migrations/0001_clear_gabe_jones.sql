CREATE TABLE "page_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"settings" jsonb NOT NULL,
	"tree" jsonb NOT NULL,
	"saved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"settings" jsonb NOT NULL,
	"tree" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_saved_by_user_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_versions_page_version_idx" ON "page_versions" USING btree ("page_id","version");--> statement-breakpoint
CREATE INDEX "page_versions_page_created_idx" ON "page_versions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_project_route_idx" ON "pages" USING btree ("project_id","route");