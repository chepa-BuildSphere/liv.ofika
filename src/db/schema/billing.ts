import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, platformAdmins } from "./accounts";
import { billingSettingEnum, statementStatusEnum } from "./enums";

// Historique des changements de facturation (bouton ON/OFF et prix), par entreprise
export const billingSettingChanges = pgTable("billing_setting_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  setting: billingSettingEnum("setting").notNull(),
  oldValue: text("old_value").notNull(),
  newValue: text("new_value").notNull(),
  changedByAdminId: uuid("changed_by_admin_id")
    .notNull()
    .references(() => platformAdmins.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relevé de fin de mois par entreprise.
// Calcul : livraisons DELIVERED du mois (forcées comprises, is_test = false), somme de deliveries.billed_price.
export const monthlyStatements = pgTable(
  "monthly_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    period: date("period").notNull(), // 1er jour du mois, ex. 2026-12-01
    deliveredCount: integer("delivered_count").notNull(),
    freeCount: integer("free_count").notNull(), // livrées pendant une période gratuite (0 F)
    totalAmount: integer("total_amount").notNull(), // en F CFA
    status: statementStatusEnum("status").notNull().default("OPEN"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    markedPaidByAdminId: uuid("marked_paid_by_admin_id").references(() => platformAdmins.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("monthly_statements_company_period_uq").on(t.companyId, t.period)],
);

// Interrupteurs globaux de fonctionnalités (ex. otp_enabled = false pendant la maintenance)
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Paramètres globaux de la plateforme (ex. default_price_per_delivery affiché sur l'accueil et appliqué aux nouvelles entreprises)
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => platformAdmins.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

