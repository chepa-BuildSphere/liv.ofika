import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, couriers, users } from "./accounts";
import { deliveries } from "./deliveries";
import { actorTypeEnum, disputeReasonEnum, disputeStatusEnum } from "./enums";

// Remises d'espèces et rapprochement de caisse livreur (MVP 1 §4)
export const cashHandovers = pgTable(
  "cash_handovers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    courierId: uuid("courier_id")
      .notNull()
      .references(() => couriers.id),
    expectedAmount: integer("expected_amount").notNull(),
    handedOverAmount: integer("handed_over_amount").notNull(),
    discrepancy: integer("discrepancy").notNull(), // écart (reçu - attendu)
    receivedByUserId: uuid("received_by_user_id")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cash_handovers_company_idx").on(t.companyId),
    index("cash_handovers_courier_idx").on(t.courierId),
  ],
);

// Fil de discussion entreprise <-> livreur sur une livraison (MVP 1 §6)
export const deliveryComments = pgTable(
  "delivery_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    authorType: actorTypeEnum("author_type").notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("delivery_comments_delivery_idx").on(t.deliveryId),
    index("delivery_comments_company_idx").on(t.companyId),
  ],
);

// Litiges sur une livraison (MVP 1 §6)
export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    openedByUserId: uuid("opened_by_user_id").references(() => users.id),
    reason: disputeReasonEnum("reason").notNull(),
    status: disputeStatusEnum("status").notNull().default("OPEN"),
    description: text("description").notNull(),
    resolutionNotes: text("resolution_notes"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("disputes_delivery_idx").on(t.deliveryId),
    index("disputes_company_idx").on(t.companyId),
    index("disputes_company_status_idx").on(t.companyId, t.status),
  ],
);
