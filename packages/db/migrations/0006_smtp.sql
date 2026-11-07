CREATE TABLE "email_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"account_id" text,
	"sent_with" text,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"kind" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smtp_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"security" text NOT NULL,
	"username" text,
	"password_ciphertext" text,
	"password_iv" text,
	"password_tag" text,
	"key_version" integer,
	"from_name" text NOT NULL,
	"from_address" text NOT NULL,
	"reply_to" text,
	"rate_limit_per_minute" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smtp_accounts" ADD CONSTRAINT "smtp_accounts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_queue_due_idx" ON "email_queue" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_queue_sent_idx" ON "email_queue" USING btree ("sent_with","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "smtp_accounts_name_idx" ON "smtp_accounts" USING btree ("name");