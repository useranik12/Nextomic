DROP TABLE "email_templates" CASCADE;--> statement-breakpoint
DROP TABLE "smtp_accounts" CASCADE;--> statement-breakpoint
DROP INDEX "email_queue_sent_idx";--> statement-breakpoint
ALTER TABLE "email_queue" DROP COLUMN "account_id";--> statement-breakpoint
ALTER TABLE "email_queue" DROP COLUMN "sent_with";