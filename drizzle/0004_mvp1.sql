-- Enums updates
DO $$ BEGIN
  ALTER TYPE "public"."proof_mode" ADD VALUE IF NOT EXISTS 'QR_PHOTO';
  ALTER TYPE "public"."proof_mode" ADD VALUE IF NOT EXISTS 'QR_PHOTO_SIGNATURE';
  ALTER TYPE "public"."proof_mode" ADD VALUE IF NOT EXISTS 'REVERSE_QR';
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."proof_method" ADD VALUE IF NOT EXISTS 'QR_PHOTO';
  ALTER TYPE "public"."proof_method" ADD VALUE IF NOT EXISTS 'QR_PHOTO_SIGNATURE';
  ALTER TYPE "public"."proof_method" ADD VALUE IF NOT EXISTS 'REVERSE_QR';
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."payment_method" AS ENUM ('CASH', 'WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'MOOV_MONEY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."dispute_status" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."dispute_reason" AS ENUM ('PACKAGE_NOT_RECEIVED', 'PACKAGE_DAMAGED', 'PAYMENT_DISCREPANCY', 'WRONG_ITEMS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "public"."deliveries" 
  ADD COLUMN IF NOT EXISTS "proof_photo_url" text,
  ADD COLUMN IF NOT EXISTS "proof_signature_url" text,
  ADD COLUMN IF NOT EXISTS "proof_recipient_name" text,
  ADD COLUMN IF NOT EXISTS "reverse_qr_token_hash" text,
  ADD COLUMN IF NOT EXISTS "reverse_qr_generated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "amount_collected" integer,
  ADD COLUMN IF NOT EXISTS "payment_method" "public"."payment_method",
  ADD COLUMN IF NOT EXISTS "payment_reference" text,
  ADD COLUMN IF NOT EXISTS "payment_collected_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."cash_handovers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "public"."companies"("id"),
  "courier_id" uuid NOT NULL REFERENCES "public"."couriers"("id"),
  "expected_amount" integer NOT NULL,
  "handed_over_amount" integer NOT NULL,
  "discrepancy" integer NOT NULL,
  "received_by_user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_handovers_company_idx" ON "public"."cash_handovers" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_handovers_courier_idx" ON "public"."cash_handovers" ("courier_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."delivery_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL REFERENCES "public"."deliveries"("id"),
  "company_id" uuid NOT NULL REFERENCES "public"."companies"("id"),
  "author_type" "public"."actor_type" NOT NULL,
  "author_id" text NOT NULL,
  "author_name" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_comments_delivery_idx" ON "public"."delivery_comments" ("delivery_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_comments_company_idx" ON "public"."delivery_comments" ("company_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."disputes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL REFERENCES "public"."deliveries"("id"),
  "company_id" uuid NOT NULL REFERENCES "public"."companies"("id"),
  "opened_by_user_id" uuid REFERENCES "public"."users"("id"),
  "reason" "public"."dispute_reason" NOT NULL,
  "status" "public"."dispute_status" DEFAULT 'OPEN' NOT NULL,
  "description" text NOT NULL,
  "resolution_notes" text,
  "resolved_by_user_id" uuid REFERENCES "public"."users"("id"),
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_delivery_idx" ON "public"."disputes" ("delivery_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_company_idx" ON "public"."disputes" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_company_status_idx" ON "public"."disputes" ("company_id", "status");
