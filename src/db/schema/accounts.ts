import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companyStatusEnum, employmentTypeEnum, userRoleEnum } from "./enums";

// Admin plateforme (toi). Aucun lien avec une entreprise.
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Entreprise cliente (grossiste, marchand, e-commerçant)
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  phone: text("phone"),
  status: companyStatusEnum("status").notNull().default("ACTIVE"),

  // Facturation (mvp.md §6.8) — modifiable uniquement par l'admin plateforme
  billingEnabled: boolean("billing_enabled").notNull().default(true), // OFF = période gratuite
  pricePerDelivery: integer("price_per_delivery").notNull().default(10), // en francs CFA

  // Option OTP (en maintenance dans le MVP) — n'a d'effet que si le flag global est actif
  otpEnabled: boolean("otp_enabled").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Utilisateur d'une entreprise (admin entreprise, gestionnaire, responsable retours)
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_company_idx").on(t.companyId)],
);

// Un utilisateur peut cumuler plusieurs rôles
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: userRoleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

// Livreur : UN SEUL compte, même s'il travaille pour plusieurs entreprises
export const couriers = pgTable("couriers", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(), // identifiant de connexion
  name: text("name").notNull(),
  pinHash: text("pin_hash"), // code PIN à 6 chiffres choisi par le livreur, haché
  pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Rattachement livreur ↔ entreprise (employé ou indépendant, par entreprise)
export const companyCouriers = pgTable(
  "company_couriers",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    courierId: uuid("courier_id")
      .notNull()
      .references(() => couriers.id),
    employmentType: employmentTypeEnum("employment_type").notNull(),
    isActive: boolean("is_active").notNull().default(true), // false = détaché par l'entreprise
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
    detachedAt: timestamp("detached_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.companyId, t.courierId] }),
    index("company_couriers_courier_idx").on(t.courierId),
  ],
);

// Sessions de connexion (utilisateurs, livreurs, admins plateforme).
// L'empreinte de l'appareil du livreur sert à refuser un scan fait depuis son propre téléphone.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").references(() => users.id),
    courierId: uuid("courier_id").references(() => couriers.id),
    platformAdminId: uuid("platform_admin_id").references(() => platformAdmins.id),
    deviceFingerprint: text("device_fingerprint"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_courier_idx").on(t.courierId)],
);
