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
import { companyStatusEnum, employmentTypeEnum, userAccessTokenPurposeEnum, userRoleEnum } from "./enums";

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
    // Vide tant que le compte n'est pas activé : l'utilisateur choisit lui-même
    // son mot de passe via un lien d'activation (user_access_tokens).
    passwordHash: text("password_hash"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_company_idx").on(t.companyId)],
);

// Liens à usage unique envoyés à un utilisateur : activation du compte
// (choix du premier mot de passe), plus tard réinitialisation du mot de passe.
// Seule l'empreinte du jeton est stockée ; le lien n'est montré qu'une fois.
export const userAccessTokens = pgTable(
  "user_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    purpose: userAccessTokenPurposeEnum("purpose").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // remplacé par un lien plus récent
    createdByPlatformAdminId: uuid("created_by_platform_admin_id").references(() => platformAdmins.id),
    createdByUserId: uuid("created_by_user_id").references(() => users.id), // admin entreprise (tâche 1.4)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_access_tokens_user_idx").on(t.userId)],
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
  pinSetAt: timestamp("pin_set_at", { withTimezone: true }), // premier accès fait
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Code d'accès à 6 chiffres pour le premier accès du livreur (choix de son PIN).
// Donné par l'entreprise au livreur. Seule l'empreinte (HMAC) est stockée.
// Volontairement HORS des tables d'entreprise (tenantScope) : au premier accès,
// le livreur n'est rattaché à aucun contexte d'entreprise ; on le retrouve par
// son téléphone. `issuedByCompanyId` sert à la traçabilité.
export const courierAccessCodes = pgTable(
  "courier_access_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courierId: uuid("courier_id")
      .notNull()
      .references(() => couriers.id),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // remplacé, ou trop d'essais faux
    failedAttempts: integer("failed_attempts").notNull().default(0),
    issuedByCompanyId: uuid("issued_by_company_id")
      .notNull()
      .references(() => companies.id),
    issuedByUserId: uuid("issued_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("courier_access_codes_courier_idx").on(t.courierId)],
);

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
