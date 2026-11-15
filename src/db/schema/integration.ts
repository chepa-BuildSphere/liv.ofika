import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./accounts";
import { apiKeyEnvironmentEnum, webhookDeliveryStatusEnum } from "./enums";

// Clés API par entreprise. La clé complète n'est montrée qu'une fois, puis seul son hash est gardé.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(), // début visible de la clé, pour la reconnaître (ex. ofk_live_ab12)
    keyHash: text("key_hash").notNull().unique(),
    environment: apiKeyEnvironmentEnum("environment").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_keys_company_idx").on(t.companyId)],
);

// Évite de créer deux fois la même livraison si un site renvoie la même requête
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    environment: apiKeyEnvironmentEnum("environment").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idempotency_company_key_uq").on(t.companyId, t.environment, t.key)],
);

// Adresses de webhook configurées par l'entreprise
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    url: text("url").notNull(),
    // TEST = reçoit uniquement les événements des livraisons de test, LIVE = uniquement les réelles
    environment: apiKeyEnvironmentEnum("environment").notNull(),
    // Secret de signature HMAC. Il doit pouvoir être relu pour signer :
    // on le stocke CHIFFRÉ (clé de chiffrement dans les variables d'environnement), pas haché.
    secretEncrypted: text("secret_encrypted").notNull(),
    events: text("events").array().notNull(), // ex. ["delivery.delivered", "delivery.failed"]
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_company_idx").on(t.companyId)],
);

// Chaque envoi de webhook, avec les nouvelles tentatives
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id),
    eventType: text("event_type").notNull(), // ex. delivery.delivered, webhook.test
    payload: jsonb("payload").notNull(), // contient reference, metadata, livemode…
    status: webhookDeliveryStatusEnum("status").notNull().default("PENDING"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastResponseStatus: integer("last_response_status"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_pending_idx").on(t.status, t.nextAttemptAt)],
);
