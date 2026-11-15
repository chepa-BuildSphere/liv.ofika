import {
  bigserial,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, couriers, users } from "./accounts";
import { deliveries, deliveryAttempts } from "./deliveries";
import {
  actorTypeEnum,
  deliveryStatusEnum,
  otpStatusEnum,
  qrTokenStatusEnum,
  securityAlertTypeEnum,
} from "./enums";

// QR de validation + code de remise à 4 chiffres (mvp.md §6.3 et §8.2)
// - Le QR contient https://<domaine>/c/<jeton>. Seul le hash du jeton est stocké.
// - Le code à 4 chiffres est généré au premier scan et affiché au client. Seul son hash est stocké.
// - Valable 3 minutes après la génération du QR, 3 essais au maximum.
export const qrTokens = pgTable(
  "qr_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => deliveryAttempts.id),
    courierId: uuid("courier_id")
      .notNull()
      .references(() => couriers.id),

    tokenHash: text("token_hash").notNull().unique(),
    status: qrTokenStatusEnum("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // création + 3 min

    // Empreinte de l'appareil du livreur au moment de la génération
    courierDeviceFingerprint: text("courier_device_fingerprint"),

    // Rempli au scan par le client (heure serveur, localisation, empreinte, IP)
    handoverCodeHash: text("handover_code_hash"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    clientDeviceFingerprint: text("client_device_fingerprint"),
    clientIp: text("client_ip"),
    clientUserAgent: text("client_user_agent"),
    clientLat: doublePrecision("client_lat"),
    clientLng: doublePrecision("client_lng"),
    clientAccuracy: doublePrecision("client_accuracy"),

    // Saisie du code par le livreur
    failedCodeAttempts: integer("failed_code_attempts").notNull().default(0), // bloqué à 3
    usedAt: timestamp("used_at", { withTimezone: true }),
    courierLatAtValidation: doublePrecision("courier_lat_at_validation"),
    courierLngAtValidation: doublePrecision("courier_lng_at_validation"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("qr_tokens_delivery_idx").on(t.deliveryId),
    // Pour détecter un même appareil « client » sur plusieurs livraisons d'un même livreur
    index("qr_tokens_courier_client_device_idx").on(t.courierId, t.clientDeviceFingerprint),
  ],
);

// OTP (option en MAINTENANCE dans le MVP : table prête, fonctionnalité désactivée)
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => deliveryAttempts.id),
    codeHash: text("code_hash").notNull(),
    status: otpStatusEnum("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(1), // renvois limités à 3
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_codes_delivery_idx").on(t.deliveryId)],
);

// Journal d'audit — AJOUT SEUL.
// UPDATE et DELETE sont interdits par un trigger SQL (voir sql/001_audit_append_only.sql).
// Chaînage : hash = SHA-256(prev_hash + contenu de l'événement).
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    companyId: uuid("company_id").references(() => companies.id),
    deliveryId: uuid("delivery_id").references(() => deliveries.id),

    eventType: text("event_type").notNull(), // ex. DELIVERY_ARRIVED, QR_LOCKED, RETURN_RECEIVED, SUPPORT_VIEW
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"), // id de l'utilisateur, du livreur, de la clé API…

    fromStatus: deliveryStatusEnum("from_status"),
    toStatus: deliveryStatusEnum("to_status"),
    payload: jsonb("payload"), // détails (motif, preuve, ancienne/nouvelle valeur…)

    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    accuracy: doublePrecision("accuracy"),
    ip: text("ip"),
    userAgent: text("user_agent"),

    serverTime: timestamp("server_time", { withTimezone: true }).notNull().defaultNow(),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("audit_events_delivery_idx").on(t.deliveryId),
    index("audit_events_company_time_idx").on(t.companyId, t.serverTime),
  ],
);

// Alertes de sécurité (ex. deuxième téléphone du livreur)
export const securityAlerts = pgTable(
  "security_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    courierId: uuid("courier_id").references(() => couriers.id),
    deliveryId: uuid("delivery_id").references(() => deliveries.id),
    type: securityAlertTypeEnum("type").notNull(),
    details: jsonb("details"), // ex. liste des livraisons concernées, empreinte de l'appareil
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("security_alerts_company_idx").on(t.companyId)],
);
