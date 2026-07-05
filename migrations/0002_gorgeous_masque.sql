ALTER TYPE "subscription_status" ADD VALUE 'incomplete';--> statement-breakpoint
ALTER TYPE "subscription_status" ADD VALUE 'unpaid';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "currency" SET DEFAULT 'QAR';--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_interval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "grace_until" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");--> statement-breakpoint

-- The platform's operating currency moved from USD to QAR (see migration 0001
-- for the column-default changes). Backfill any rows seeded before that switch.
UPDATE "products"      SET "currency" = 'QAR' WHERE "currency" = 'USD';--> statement-breakpoint
UPDATE "orders"         SET "currency" = 'QAR' WHERE "currency" = 'USD';--> statement-breakpoint
UPDATE "payments"       SET "currency" = 'QAR' WHERE "currency" = 'USD';--> statement-breakpoint
UPDATE "subscriptions"  SET "currency" = 'QAR' WHERE "currency" = 'USD';