ALTER TYPE "order_status" ADD VALUE 'pending_payment';--> statement-breakpoint
ALTER TYPE "order_status" ADD VALUE 'payment_failed';--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE 'pending';--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE 'partially_refunded';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"capacity" integer DEFAULT 10 NOT NULL,
	"booked_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"stripe_refund_id" text,
	"amount_minor" integer NOT NULL,
	"reason" text,
	"actor" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
DROP INDEX IF EXISTS "orders_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "orders_status_idx";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'QAR';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'QAR';--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "low_stock_threshold" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "scheduled_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" text DEFAULT 'stub' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text DEFAULT 'QAR' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_slots" ADD CONSTRAINT "delivery_slots_tenant_id_stores_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorites" ADD CONSTRAINT "favorites_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slots_tenant_date_idx" ON "delivery_slots" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favorites_user_store_idx" ON "favorites" USING btree ("user_id","store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_jobs_rider_idx" ON "delivery_jobs" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_jobs_order_idx" ON "delivery_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_tenant_product_idx" ON "inventory" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status","placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_unpublished_idx" ON "outbox" USING btree ("published_at","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_order_idx" ON "stock_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_expiry_idx" ON "stock_reservations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id");