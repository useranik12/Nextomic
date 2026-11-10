CREATE TABLE "action_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"block" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_flows" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"page_id" text,
	"template_id" text,
	"node_id" text NOT NULL,
	"flows" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_flows_one_owner" CHECK (("action_flows"."page_id" is null) <> ("action_flows"."template_id" is null))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "published_action_blocks" jsonb;--> statement-breakpoint
ALTER TABLE "action_blocks" ADD CONSTRAINT "action_blocks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_blocks" ADD CONSTRAINT "action_blocks_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_flows" ADD CONSTRAINT "action_flows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_flows" ADD CONSTRAINT "action_flows_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_flows" ADD CONSTRAINT "action_flows_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_flows" ADD CONSTRAINT "action_flows_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_blocks_project_idx" ON "action_blocks" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_flows_page_node_idx" ON "action_flows" USING btree ("page_id","node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "action_flows_template_node_idx" ON "action_flows" USING btree ("template_id","node_id");