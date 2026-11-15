import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, couriers, users } from "./accounts";
import {
  afterFailureEnum,
  attemptOutcomeEnum,
  deliveryStatusEnum,
  failureReasonEnum,
  proofMethodEnum,
  proofModeEnum,
  returnConditionEnum,
} from "./enums";

// Livraison (= un colis)
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),

    // Mode test : créée avec une clé test. Jamais facturée, jamais envoyée à un livreur.
    isTest: boolean("is_test").notNull().default(false),

    reference: text("reference").notNull(), // référence de commande du site e-commerce
    metadata: jsonb("metadata"), // données libres du site, renvoyées telles quelles dans les webhooks
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    address: text("address").notNull(),
    district: text("district"), // quartier
    packageDescription: text("package_description"),
    amountToCollect: integer("amount_to_collect"), // prix affiché, en F CFA (information dans le MVP)
    comment: text("comment"),

    proofMode: proofModeEnum("proof_mode").notNull().default("QR"),
    status: deliveryStatusEnum("status").notNull().default("CREATED"),
    courierId: uuid("courier_id").references(() => couriers.id),
    currentAttempt: integer("current_attempt").notNull().default(0),

    // Rempli au passage à DELIVERED
    proofMethod: proofMethodEnum("proof_method"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    // Prix figé au moment de la livraison (0 si facturation OFF). Jamais recalculé.
    billedPrice: integer("billed_price"),

    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deliveries_company_reference_uq").on(t.companyId, t.isTest, t.reference),
    index("deliveries_company_status_idx").on(t.companyId, t.isTest, t.status),
    index("deliveries_courier_status_idx").on(t.courierId, t.status),
    index("deliveries_company_delivered_at_idx").on(t.companyId, t.deliveredAt), // relevés mensuels
  ],
);

// Une tentative = un passage chez le destinataire. Pas de limite par jour.
export const deliveryAttempts = pgTable(
  "delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id),
    courierId: uuid("courier_id")
      .notNull()
      .references(() => couriers.id),
    attemptNumber: integer("attempt_number").notNull(),
    outcome: attemptOutcomeEnum("outcome").notNull().default("IN_PROGRESS"),

    // « Arrivé chez le destinataire » (heure serveur + GPS du livreur)
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    arrivedLat: doublePrecision("arrived_lat"),
    arrivedLng: doublePrecision("arrived_lng"),
    arrivedAccuracy: doublePrecision("arrived_accuracy"), // en mètres

    // Échec
    failureReason: failureReasonEnum("failure_reason"),
    failureComment: text("failure_comment"),
    failurePhotoUrl: text("failure_photo_url"),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failedLat: doublePrecision("failed_lat"),
    failedLng: doublePrecision("failed_lng"),
    afterFailure: afterFailureEnum("after_failure"), // nouvelle tentative ou retour au dépôt

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("delivery_attempts_number_uq").on(t.deliveryId, t.attemptNumber)],
);

// « Forcer Livré » par l'admin entreprise (mvp.md §6.6)
export const manualOverrides = pgTable("manual_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .unique()
    .references(() => deliveries.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(), // motif obligatoire
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Réception physique d'un retour au dépôt
export const returnReceptions = pgTable("return_receptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .unique()
    .references(() => deliveries.id),
  receivedByUserId: uuid("received_by_user_id")
    .notNull()
    .references(() => users.id),
  condition: returnConditionEnum("condition").notNull(),
  comment: text("comment"),
  photoUrl: text("photo_url"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
