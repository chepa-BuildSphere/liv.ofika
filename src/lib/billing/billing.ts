import { desc, eq, gte, lt } from "drizzle-orm";
import {
  billingSettingChanges,
  companies,
  deliveries,
  monthlyStatements,
  platformAdmins,
  platformSettings,
} from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, platformAdminActor, userActor } from "@/lib/auth/permissions";
import type { AdminIdentity } from "@/lib/auth/platform-admin";
import { tenantScope } from "@/lib/tenant/scope";
import {
  BILLING_SETTING_LABEL,
  DEFAULT_PRICE_PER_DELIVERY,
  formatBillingPeriod,
  formatBillingSettingValue,
  STATEMENT_STATUS_LABEL,
  type StatementStatus,
} from "./billing-labels";

export {
  BILLING_SETTING_LABEL,
  DEFAULT_PRICE_PER_DELIVERY,
  formatBillingPeriod,
  formatBillingSettingValue,
  STATEMENT_STATUS_LABEL,
  type StatementStatus,
};

const MAX_PRICE_CFA = 100_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD_RE = /^(\d{4})-(\d{2})(?:-01)?$/;

export const PLATFORM_PRICE_KEY = "default_price_per_delivery";
export const PLATFORM_PRICE_CACHE_TAG = "platform-pricing";


export type BillingErrorCode = "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "ALREADY_PAID";

export class BillingError extends Error {
  constructor(
    readonly code: BillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export type BillingHistoryEntry = {
  id: string;
  setting: "BILLING_ENABLED" | "PRICE_PER_DELIVERY";
  oldValue: string;
  newValue: string;
  changedByAdminName: string;
  createdAt: Date;
};

export type PriceBreakdownRow = {
  unitPrice: number;
  count: number;
  subtotal: number;
};

export type PeriodBillingSummary = {
  period: string;
  startUtc: Date;
  endExclusiveUtc: Date;
  deliveredCount: number;
  forcedCount: number;
  freeCount: number;
  totalAmount: number;
  priceBreakdown: PriceBreakdownRow[];
};

export type CompanyBillingOverview = {
  company: {
    id: string;
    name: string;
    billingEnabled: boolean;
    pricePerDelivery: number;
  };
  currentPeriod: PeriodBillingSummary;
  statements: (typeof monthlyStatements.$inferSelect)[];
  history: BillingHistoryEntry[];
};

export type AdminMonthlyStatementRow = {
  statement: typeof monthlyStatements.$inferSelect;
  companyName: string;
  companySlug: string;
  billingEnabled: boolean;
  pricePerDelivery: number;
};

/** Valide un tarif unitaire par livraison en F CFA (entier entre 0 et 100 000). */
export function validatePricePerDelivery(
  raw: number | string,
): { ok: true; price: number } | { ok: false; error: string } {
  let num: number;
  if (typeof raw === "number") {
    num = raw;
  } else {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      return {
        ok: false,
        error: "Indiquez un prix entier positif ou nul en F CFA (sans virgule).",
      };
    }
    num = Number(trimmed);
  }

  if (!Number.isSafeInteger(num) || num < 0 || num > MAX_PRICE_CFA) {
    return {
      ok: false,
      error: `Le prix par livraison doit être un entier entre 0 et ${MAX_PRICE_CFA.toLocaleString("fr-FR")} F CFA.`,
    };
  }

  return { ok: true, price: num };
}

/** Parse une période (`YYYY-MM` ou `YYYY-MM-01`) vers le 1er du mois et ses bornes UTC. */
export function parseBillingPeriod(
  raw?: string | null,
  now = new Date(),
): { period: string; startUtc: Date; endExclusiveUtc: Date } {
  let year: number;
  let month: number;

  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  } else {
    const match = PERIOD_RE.exec(trimmed);
    if (!match) {
      throw new BillingError(
        "INVALID",
        "Période invalide (format attendu : AAAA-MM ou AAAA-MM-01).",
      );
    }
    year = Number(match[1]);
    month = Number(match[2]);
    if (year < 2020 || year > 2100 || month < 1 || month > 12) {
      throw new BillingError("INVALID", "Mois ou année de facturation hors bornes.");
    }
  }

  const period = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const startUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endExclusiveUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return { period, startUtc, endExclusiveUtc };
}

/** Active ou désactive la facturation (ON / OFF) pour une entreprise et historise le changement. */
export async function toggleCompanyBilling(
  db: Executor,
  admin: AdminIdentity,
  companyId: string,
  billingEnabled: boolean,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ changed: boolean; billingEnabled: boolean }> {
  if (!UUID_RE.test(companyId)) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }
  if (!can(platformAdminActor(admin), "billing.toggle", { companyId }).allowed) {
    throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
  }

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: companies.id,
        billingEnabled: companies.billingEnabled,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .for("update")
      .limit(1);

    if (!current) {
      throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
    }

    if (current.billingEnabled === billingEnabled) {
      return { changed: false, billingEnabled: current.billingEnabled };
    }

    await tx
      .update(companies)
      .set({ billingEnabled, updatedAt: new Date() })
      .where(eq(companies.id, current.id));

    await tenantScope(tx, current.id).insert(billingSettingChanges, {
      setting: "BILLING_ENABLED",
      oldValue: String(current.billingEnabled),
      newValue: String(billingEnabled),
      changedByAdminId: admin.id,
    });

    await logEvent(tx, {
      companyId: current.id,
      eventType: "BILLING_SETTING_CHANGED",
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      payload: {
        setting: "BILLING_ENABLED",
        oldValue: current.billingEnabled,
        newValue: billingEnabled,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return { changed: true, billingEnabled };
  });
}

/** Modifie le prix par livraison d'une entreprise et historise le changement. */
export async function setCompanyDeliveryPrice(
  db: Executor,
  admin: AdminIdentity,
  companyId: string,
  rawPrice: number | string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ changed: boolean; pricePerDelivery: number }> {
  if (!UUID_RE.test(companyId)) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }
  if (!can(platformAdminActor(admin), "billing.setPrice", { companyId }).allowed) {
    throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
  }

  const valid = validatePricePerDelivery(rawPrice);
  if (!valid.ok) {
    throw new BillingError("INVALID", valid.error);
  }

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: companies.id,
        pricePerDelivery: companies.pricePerDelivery,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .for("update")
      .limit(1);

    if (!current) {
      throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
    }

    if (current.pricePerDelivery === valid.price) {
      return { changed: false, pricePerDelivery: current.pricePerDelivery };
    }

    await tx
      .update(companies)
      .set({ pricePerDelivery: valid.price, updatedAt: new Date() })
      .where(eq(companies.id, current.id));

    await tenantScope(tx, current.id).insert(billingSettingChanges, {
      setting: "PRICE_PER_DELIVERY",
      oldValue: String(current.pricePerDelivery),
      newValue: String(valid.price),
      changedByAdminId: admin.id,
    });

    await logEvent(tx, {
      companyId: current.id,
      eventType: "BILLING_SETTING_CHANGED",
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      payload: {
        setting: "PRICE_PER_DELIVERY",
        oldValue: current.pricePerDelivery,
        newValue: valid.price,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return { changed: true, pricePerDelivery: valid.price };
  });
}

/**
 * Lit le tarif unitaire par livraison de la plateforme en base de données
 * (affiché sur la page d'accueil, l'inscription et appliqué aux nouvelles entreprises).
 */
export async function getPlatformPricePerDelivery(db: Executor): Promise<number> {
  try {
    const [setting] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, PLATFORM_PRICE_KEY))
      .limit(1);

    if (setting) {
      const parsed = validatePricePerDelivery(setting.value);
      if (parsed.ok) return parsed.price;
    }

    const [latestCompany] = await db
      .select({ pricePerDelivery: companies.pricePerDelivery })
      .from(companies)
      .orderBy(desc(companies.updatedAt))
      .limit(1);

    if (latestCompany && Number.isSafeInteger(latestCompany.pricePerDelivery) && latestCompany.pricePerDelivery >= 0) {
      return latestCompany.pricePerDelivery;
    }
  } catch {
    // Repli sécurisé si la table n'est pas encore accessible lors d'un build hors-ligne
  }

  return DEFAULT_PRICE_PER_DELIVERY;
}

/**
 * Modifie le tarif par livraison de la plateforme (affiché sur la page d'accueil et appliqué par défaut),
 * et met optionnellement à jour le tarif des entreprises existantes en historisant chaque changement.
 */
export async function setPlatformPricePerDelivery(
  db: Executor,
  admin: AdminIdentity,
  rawPrice: number | string,
  opts: {
    applyToExistingCompanies?: boolean;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<{
  changed: boolean;
  pricePerDelivery: number;
  updatedCompaniesCount: number;
}> {
  if (!can(platformAdminActor(admin), "billing.setPrice", { companyId: "" }).allowed) {
    throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
  }

  const valid = validatePricePerDelivery(rawPrice);
  if (!valid.ok) {
    throw new BillingError("INVALID", valid.error);
  }

  return db.transaction(async (tx) => {
    const oldPrice = await getPlatformPricePerDelivery(tx);
    const now = new Date();

    await tx
      .insert(platformSettings)
      .values({
        key: PLATFORM_PRICE_KEY,
        value: String(valid.price),
        updatedByAdminId: admin.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: String(valid.price),
          updatedByAdminId: admin.id,
          updatedAt: now,
        },
      });

    if (oldPrice !== valid.price) {
      await logEvent(tx, {
        companyId: null,
        eventType: "PLATFORM_PRICE_CHANGED",
        actorType: "PLATFORM_ADMIN",
        actorId: admin.id,
        payload: {
          setting: "DEFAULT_PRICE_PER_DELIVERY",
          oldValue: oldPrice,
          newValue: valid.price,
          applyToExistingCompanies: Boolean(opts.applyToExistingCompanies),
        },
        ip: opts.meta?.ip ?? null,
        userAgent: opts.meta?.userAgent ?? null,
      });
    }

    let updatedCompaniesCount = 0;

    if (opts.applyToExistingCompanies) {
      const allCompanies = await tx
        .select({
          id: companies.id,
          pricePerDelivery: companies.pricePerDelivery,
        })
        .from(companies)
        .for("update");

      for (const comp of allCompanies) {
        if (comp.pricePerDelivery === valid.price) continue;

        await tx
          .update(companies)
          .set({ pricePerDelivery: valid.price, updatedAt: now })
          .where(eq(companies.id, comp.id));

        await tenantScope(tx, comp.id).insert(billingSettingChanges, {
          setting: "PRICE_PER_DELIVERY",
          oldValue: String(comp.pricePerDelivery),
          newValue: String(valid.price),
          changedByAdminId: admin.id,
        });

        await logEvent(tx, {
          companyId: comp.id,
          eventType: "BILLING_SETTING_CHANGED",
          actorType: "PLATFORM_ADMIN",
          actorId: admin.id,
          payload: {
            setting: "PRICE_PER_DELIVERY",
            oldValue: comp.pricePerDelivery,
            newValue: valid.price,
          },
          ip: opts.meta?.ip ?? null,
          userAgent: opts.meta?.userAgent ?? null,
        });

        updatedCompaniesCount += 1;
      }
    }

    return {
      changed: oldPrice !== valid.price || updatedCompaniesCount > 0,
      pricePerDelivery: valid.price,
      updatedCompaniesCount,
    };
  });
}

/** Liste l'historique des modifications de réglages de facturation d'une entreprise. */
export async function listCompanyBillingHistory(
  db: Executor,
  companyId: string,
): Promise<BillingHistoryEntry[]> {
  if (!UUID_RE.test(companyId)) return [];

  return db
    .select({
      id: billingSettingChanges.id,
      setting: billingSettingChanges.setting,
      oldValue: billingSettingChanges.oldValue,
      newValue: billingSettingChanges.newValue,
      changedByAdminName: platformAdmins.name,
      createdAt: billingSettingChanges.createdAt,
    })
    .from(billingSettingChanges)
    .innerJoin(platformAdmins, eq(billingSettingChanges.changedByAdminId, platformAdmins.id))
    .where(tenantScope(db, companyId).filter(billingSettingChanges))
    .orderBy(desc(billingSettingChanges.createdAt));
}

/**
 * Calcule le bilan mensuel des livraisons livrées (`DELIVERED`, forcées comprises,
 * hors mode test) à partir du prix figé `billed_price`.
 */
export async function computeCompanyPeriodBilling(
  db: Executor,
  companyId: string,
  rawPeriod?: string | null,
  now = new Date(),
): Promise<PeriodBillingSummary> {
  if (!UUID_RE.test(companyId)) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }

  const { period, startUtc, endExclusiveUtc } = parseBillingPeriod(rawPeriod, now);

  const rows = await db
    .select({
      billedPrice: deliveries.billedPrice,
      proofMethod: deliveries.proofMethod,
    })
    .from(deliveries)
    .where(
      tenantScope(db, companyId).filter(
        deliveries,
        eq(deliveries.status, "DELIVERED"),
        eq(deliveries.isTest, false),
        gte(deliveries.deliveredAt, startUtc),
        lt(deliveries.deliveredAt, endExclusiveUtc),
      ),
    );

  let forcedCount = 0;
  let freeCount = 0;
  let totalAmount = 0;
  const countsByPrice = new Map<number, number>();

  for (const r of rows) {
    const price = r.billedPrice ?? 0;
    if (r.proofMethod === "MANUAL") forcedCount += 1;
    if (price === 0) freeCount += 1;
    totalAmount += price;
    countsByPrice.set(price, (countsByPrice.get(price) ?? 0) + 1);
  }

  const priceBreakdown: PriceBreakdownRow[] = [...countsByPrice.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([unitPrice, count]) => ({
      unitPrice,
      count,
      subtotal: unitPrice * count,
    }));

  return {
    period,
    startUtc,
    endExclusiveUtc,
    deliveredCount: rows.length,
    forcedCount,
    freeCount,
    totalAmount,
    priceBreakdown,
  };
}

/** Génère ou met à jour le relevé mensuel d'une entreprise (refusé s'il est déjà payé). */
export async function generateMonthlyStatement(
  db: Executor,
  admin: AdminIdentity,
  companyId: string,
  rawPeriod?: string | null,
  opts: {
    issue?: boolean;
    now?: Date;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<typeof monthlyStatements.$inferSelect> {
  if (!UUID_RE.test(companyId)) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }
  if (!can(platformAdminActor(admin), "billing.viewStatements", { companyId }).allowed) {
    throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
  }

  const now = opts.now ?? new Date();

  return db.transaction(async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
    }

    const summary = await computeCompanyPeriodBilling(tx, company.id, rawPeriod, now);
    const [existing] = await tenantScope(tx, company.id).selectAll(
      monthlyStatements,
      eq(monthlyStatements.period, summary.period),
    );

    if (existing?.status === "PAID") {
      throw new BillingError("ALREADY_PAID", "Ce relevé mensuel est déjà marqué comme payé.");
    }

    const nextStatus: StatementStatus = opts.issue
      ? "ISSUED"
      : existing?.status === "ISSUED"
        ? "ISSUED"
        : "OPEN";
    const nextIssuedAt = opts.issue
      ? (existing?.issuedAt ?? now)
      : (existing?.issuedAt ?? null);

    let saved: typeof monthlyStatements.$inferSelect;
    if (existing) {
      [saved] = await tenantScope(tx, company.id).update(
        monthlyStatements,
        {
          deliveredCount: summary.deliveredCount,
          freeCount: summary.freeCount,
          totalAmount: summary.totalAmount,
          status: nextStatus,
          issuedAt: nextIssuedAt,
        },
        eq(monthlyStatements.id, existing.id),
      );
    } else {
      [saved] = await tenantScope(tx, company.id).insert(monthlyStatements, {
        period: summary.period,
        deliveredCount: summary.deliveredCount,
        freeCount: summary.freeCount,
        totalAmount: summary.totalAmount,
        status: nextStatus,
        issuedAt: nextIssuedAt,
      });
    }

    await logEvent(tx, {
      companyId: company.id,
      eventType: "MONTHLY_STATEMENT_ISSUED",
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      payload: {
        statementId: saved.id,
        period: saved.period,
        deliveredCount: saved.deliveredCount,
        freeCount: saved.freeCount,
        totalAmount: saved.totalAmount,
        status: saved.status,
      },
      ip: opts.meta?.ip ?? null,
      userAgent: opts.meta?.userAgent ?? null,
    });

    return saved;
  });
}

/** Vue Facturation en lecture seule pour l'admin entreprise (tâche 7.3). */
export async function getCompanyBillingOverview(
  db: Executor,
  actor: CompanyUserIdentity,
  rawPeriod?: string | null,
  now = new Date(),
): Promise<CompanyBillingOverview> {
  if (!can(userActor(actor), "billing.viewStatements", { companyId: actor.companyId }).allowed) {
    throw new BillingError(
      "FORBIDDEN",
      "La consultation de la facturation est réservée à l'admin entreprise.",
    );
  }

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      billingEnabled: companies.billingEnabled,
      pricePerDelivery: companies.pricePerDelivery,
    })
    .from(companies)
    .where(eq(companies.id, actor.companyId))
    .limit(1);

  if (!company) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }

  const [currentPeriod, statements, history] = await Promise.all([
    computeCompanyPeriodBilling(db, company.id, rawPeriod, now),
    db
      .select()
      .from(monthlyStatements)
      .where(tenantScope(db, company.id).filter(monthlyStatements))
      .orderBy(desc(monthlyStatements.period)),
    listCompanyBillingHistory(db, company.id),
  ]);

  return {
    company,
    currentPeriod,
    statements,
    history,
  };
}

/** Vue Facturation d'une entreprise pour le back-office plateforme. */
export async function getAdminCompanyBillingOverview(
  db: Executor,
  admin: AdminIdentity,
  companyId: string,
  rawPeriod?: string | null,
  now = new Date(),
): Promise<CompanyBillingOverview> {
  if (!UUID_RE.test(companyId)) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }
  if (!can(platformAdminActor(admin), "billing.viewStatements", { companyId }).allowed) {
    throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
  }

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      billingEnabled: companies.billingEnabled,
      pricePerDelivery: companies.pricePerDelivery,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new BillingError("NOT_FOUND", "Entreprise introuvable.");
  }

  const [currentPeriod, statements, history] = await Promise.all([
    computeCompanyPeriodBilling(db, company.id, rawPeriod, now),
    db
      .select()
      .from(monthlyStatements)
      .where(tenantScope(db, company.id).filter(monthlyStatements))
      .orderBy(desc(monthlyStatements.period)),
    listCompanyBillingHistory(db, company.id),
  ]);

  return {
    company,
    currentPeriod,
    statements,
    history,
  };
}

/** Marque un relevé mensuel comme payé (`PAID`) par l'admin plateforme (tâche 7.4). */
export async function markMonthlyStatementPaid(
  db: Executor,
  admin: AdminIdentity,
  statementId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
  now = new Date(),
): Promise<{ statement: typeof monthlyStatements.$inferSelect; alreadyPaid: boolean }> {
  if (!UUID_RE.test(statementId)) {
    throw new BillingError("NOT_FOUND", "Relevé mensuel introuvable.");
  }

  return db.transaction(async (tx) => {
    // tenant-guard: back-office plateforme — relève le companyId du relevé puis met à jour via tenantScope
    const [existing] = await tx
      .select()
      .from(monthlyStatements)
      .where(eq(monthlyStatements.id, statementId))
      .for("update")
      .limit(1);

    if (!existing) {
      throw new BillingError("NOT_FOUND", "Relevé mensuel introuvable.");
    }

    if (!can(platformAdminActor(admin), "billing.markPaid", { companyId: existing.companyId }).allowed) {
      throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
    }

    if (existing.status === "PAID") {
      return { statement: existing, alreadyPaid: true };
    }

    const [updated] = await tenantScope(tx, existing.companyId).update(
      monthlyStatements,
      {
        status: "PAID",
        paidAt: now,
        issuedAt: existing.issuedAt ?? now,
        markedPaidByAdminId: admin.id,
      },
      eq(monthlyStatements.id, existing.id),
    );

    await logEvent(tx, {
      companyId: existing.companyId,
      eventType: "MONTHLY_STATEMENT_PAID",
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      payload: {
        statementId: updated.id,
        period: updated.period,
        totalAmount: updated.totalAmount,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return { statement: updated, alreadyPaid: false };
  });
}

/** Liste tous les relevés mensuels de la plateforme (/admin/facturation). */
export async function listAllMonthlyStatements(
  db: Executor,
  admin: AdminIdentity,
): Promise<AdminMonthlyStatementRow[]> {
  if (!can(platformAdminActor(admin), "billing.markPaid", { companyId: "" }).allowed) {
    throw new BillingError("FORBIDDEN", "Réservé à l'admin plateforme.");
  }

  return db
    .select({
      statement: monthlyStatements,
      companyName: companies.name,
      companySlug: companies.slug,
      billingEnabled: companies.billingEnabled,
      pricePerDelivery: companies.pricePerDelivery,
    })
    // tenant-guard: back-office plateforme — liste globale des relevés mensuels de toutes les entreprises
    .from(monthlyStatements)
    .innerJoin(companies, eq(monthlyStatements.companyId, companies.id))
    .orderBy(desc(monthlyStatements.period), desc(monthlyStatements.createdAt));
}
