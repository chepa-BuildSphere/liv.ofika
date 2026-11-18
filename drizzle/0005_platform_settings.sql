CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_by_admin_id" uuid REFERENCES "public"."platform_admins"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "public"."platform_settings" ("key", "value")
VALUES (
  'default_price_per_delivery',
  COALESCE(
    (SELECT "price_per_delivery"::text FROM "public"."companies" ORDER BY "updated_at" DESC LIMIT 1),
    '10'
  )
)
ON CONFLICT ("key") DO NOTHING;
