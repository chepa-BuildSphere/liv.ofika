CREATE TYPE "public"."actor_type" AS ENUM('PLATFORM_ADMIN', 'USER', 'COURIER', 'API_KEY', 'RECIPIENT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."after_failure" AS ENUM('RETRY', 'RETURN_TO_DEPOT');--> statement-breakpoint
CREATE TYPE "public"."api_key_environment" AS ENUM('TEST', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."attempt_outcome" AS ENUM('IN_PROGRESS', 'DELIVERED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."billing_setting" AS ENUM('BILLING_ENABLED', 'PRICE_PER_DELIVERY');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('CREATED', 'ASSIGNED', 'PICKED_UP', 'ARRIVED', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNING', 'RETURN_RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('EMPLOYEE', 'INDEPENDENT');--> statement-breakpoint
CREATE TYPE "public"."failure_reason" AS ENUM('RECIPIENT_ABSENT', 'RECIPIENT_UNREACHABLE', 'RECIPIENT_REFUSED', 'WRONG_ADDRESS', 'PAYMENT_UNAVAILABLE', 'PACKAGE_DAMAGED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."otp_status" AS ENUM('ACTIVE', 'USED', 'EXPIRED', 'LOCKED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."proof_method" AS ENUM('QR', 'QR_OTP', 'OTP', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."proof_mode" AS ENUM('QR', 'QR_OTP');--> statement-breakpoint
CREATE TYPE "public"."qr_token_status" AS ENUM('ACTIVE', 'USED', 'EXPIRED', 'LOCKED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."return_condition" AS ENUM('GOOD', 'DAMAGED');--> statement-breakpoint
CREATE TYPE "public"."security_alert_type" AS ENUM('SUSPICIOUS_DEVICE_REUSE');--> statement-breakpoint
CREATE TYPE "public"."statement_status" AS ENUM('OPEN', 'ISSUED', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('COMPANY_ADMIN', 'MANAGER', 'RETURNS_OFFICER');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"phone" text,
	"status" "company_status" DEFAULT 'ACTIVE' NOT NULL,
	"billing_enabled" boolean DEFAULT true NOT NULL,
	"price_per_delivery" integer DEFAULT 10 NOT NULL,
	"otp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_couriers" (
	"company_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detached_at" timestamp with time zone,
	CONSTRAINT "company_couriers_company_id_courier_id_pk" PRIMARY KEY("company_id","courier_id")
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"pin_hash" text,
	"pin_failed_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couriers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid,
	"courier_id" uuid,
	"platform_admin_id" uuid,
	"device_fingerprint" text,
	"ip" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"reference" text NOT NULL,
	"metadata" jsonb,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"address" text NOT NULL,
	"district" text,
	"package_description" text,
	"amount_to_collect" integer,
	"comment" text,
	"proof_mode" "proof_mode" DEFAULT 'QR' NOT NULL,
	"status" "delivery_status" DEFAULT 'CREATED' NOT NULL,
	"courier_id" uuid,
	"current_attempt" integer DEFAULT 0 NOT NULL,
	"proof_method" "proof_method",
	"delivered_at" timestamp with time zone,
	"billed_price" integer,
	"assigned_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"outcome" "attempt_outcome" DEFAULT 'IN_PROGRESS' NOT NULL,
	"arrived_at" timestamp with time zone,
	"arrived_lat" double precision,
	"arrived_lng" double precision,
	"arrived_accuracy" double precision,
	"failure_reason" "failure_reason",
	"failure_comment" text,
	"failure_photo_url" text,
	"failed_at" timestamp with time zone,
	"failed_lat" double precision,
	"failed_lng" double precision,
	"after_failure" "after_failure",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_overrides_delivery_id_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
CREATE TABLE "return_receptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"received_by_user_id" uuid NOT NULL,
	"condition" "return_condition" NOT NULL,
	"comment" text,
	"photo_url" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_receptions_delivery_id_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" uuid,
	"delivery_id" uuid,
	"event_type" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"from_status" "delivery_status",
	"to_status" "delivery_status",
	"payload" jsonb,
	"lat" double precision,
	"lng" double precision,
	"accuracy" double precision,
	"ip" text,
	"user_agent" text,
	"server_time" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"status" "otp_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 1 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "qr_token_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"courier_device_fingerprint" text,
	"handover_code_hash" text,
	"scanned_at" timestamp with time zone,
	"client_device_fingerprint" text,
	"client_ip" text,
	"client_user_agent" text,
	"client_lat" double precision,
	"client_lng" double precision,
	"client_accuracy" double precision,
	"failed_code_attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"courier_lat_at_validation" double precision,
	"courier_lng_at_validation" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "security_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"courier_id" uuid,
	"delivery_id" uuid,
	"type" "security_alert_type" NOT NULL,
	"details" jsonb,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"environment" "api_key_environment" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"environment" "api_key_environment" NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_response_status" integer,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"environment" "api_key_environment" NOT NULL,
	"secret_encrypted" text NOT NULL,
	"events" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_setting_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"setting" "billing_setting" NOT NULL,
	"old_value" text NOT NULL,
	"new_value" text NOT NULL,
	"changed_by_admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period" date NOT NULL,
	"delivered_count" integer NOT NULL,
	"free_count" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"status" "statement_status" DEFAULT 'OPEN' NOT NULL,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"marked_paid_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_couriers" ADD CONSTRAINT "company_couriers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_couriers" ADD CONSTRAINT "company_couriers_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_receptions" ADD CONSTRAINT "return_receptions_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_receptions" ADD CONSTRAINT "return_receptions_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_attempt_id_delivery_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."delivery_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_attempt_id_delivery_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."delivery_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_setting_changes" ADD CONSTRAINT "billing_setting_changes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_setting_changes" ADD CONSTRAINT "billing_setting_changes_changed_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("changed_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_statements" ADD CONSTRAINT "monthly_statements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_statements" ADD CONSTRAINT "monthly_statements_marked_paid_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("marked_paid_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_couriers_courier_idx" ON "company_couriers" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "sessions_courier_idx" ON "sessions" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "users_company_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_company_reference_uq" ON "deliveries" USING btree ("company_id","is_test","reference");--> statement-breakpoint
CREATE INDEX "deliveries_company_status_idx" ON "deliveries" USING btree ("company_id","is_test","status");--> statement-breakpoint
CREATE INDEX "deliveries_courier_status_idx" ON "deliveries" USING btree ("courier_id","status");--> statement-breakpoint
CREATE INDEX "deliveries_company_delivered_at_idx" ON "deliveries" USING btree ("company_id","delivered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_number_uq" ON "delivery_attempts" USING btree ("delivery_id","attempt_number");--> statement-breakpoint
CREATE INDEX "audit_events_delivery_idx" ON "audit_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "audit_events_company_time_idx" ON "audit_events" USING btree ("company_id","server_time");--> statement-breakpoint
CREATE INDEX "otp_codes_delivery_idx" ON "otp_codes" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "qr_tokens_delivery_idx" ON "qr_tokens" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "qr_tokens_courier_client_device_idx" ON "qr_tokens" USING btree ("courier_id","client_device_fingerprint");--> statement-breakpoint
CREATE INDEX "security_alerts_company_idx" ON "security_alerts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "api_keys_company_idx" ON "api_keys" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_company_key_uq" ON "idempotency_keys" USING btree ("company_id","environment","key");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_pending_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_company_idx" ON "webhook_endpoints" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_statements_company_period_uq" ON "monthly_statements" USING btree ("company_id","period");