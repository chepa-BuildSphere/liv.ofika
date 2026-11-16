import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  apiKeys,
  auditEvents,
  billingSettingChanges,
  companyCouriers,
  deliveries,
  idempotencyKeys,
  monthlyStatements,
  securityAlerts,
  users,
  webhookEndpoints,
} from "@/db/schema";
import type { Executor } from "@/lib/audit";

// Cloisonnement par entreprise (mvp.md §4.1, règle 2) : « un utilisateur ne voit
// jamais les données d'une autre entreprise. Ce filtre est appliqué côté serveur
// sur chaque requête. »
//
// Toute lecture ou écriture sur une table d'entreprise passe par `tenantScope`,
// qui impose `company_id = <entreprise de l'acteur>` :
//   - lectures / mises à jour : le filtre est toujours ajouté ;
//   - insertions : company_id est forcé, même si l'appelant en fournit un autre ;
//   - mises à jour : company_id ne peut pas être changé.
// Un test (tenant-guard.test.ts) lit le code et refuse tout accès direct à ces
// tables en dehors des exceptions justifiées.
//
// Pourquoi pas la RLS de PostgreSQL : Neon Realtime refuse les tables sous RLS
// (skill neon-realtime), et l'admin plateforme doit pouvoir lire en support.

/** Tables qui portent un company_id : jamais lues sans filtre. */
export const TENANT_TABLES = {
  users,
  deliveries,
  auditEvents,
  securityAlerts,
  billingSettingChanges,
  monthlyStatements,
  companyCouriers,
  apiKeys,
  idempotencyKeys,
  webhookEndpoints,
} as const;

export type TenantTable = (typeof TENANT_TABLES)[keyof typeof TENANT_TABLES];

type Extra = SQL | undefined;

export function tenantScope(db: Executor, companyId: string) {
  if (!companyId) throw new Error("tenantScope : entreprise manquante");

  /** Condition « appartient à l'entreprise » (+ conditions en plus). */
  function filter(table: TenantTable, ...extra: Extra[]): SQL {
    return and(eq(table.companyId, companyId), ...extra)!;
  }

  /** Sous-requête : identifiants des livraisons de l'entreprise. */
  function deliveryIds() {
    return db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.companyId, companyId));
  }

  return {
    companyId,
    filter,

    /** Toutes les lignes de l'entreprise (avec conditions en plus). */
    async selectAll<T extends TenantTable>(table: T, ...extra: Extra[]): Promise<T["$inferSelect"][]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await db.select().from(table as any).where(filter(table, ...extra))) as T["$inferSelect"][];
    },

    /** Insère pour l'entreprise : company_id est imposé. */
    async insert<T extends TenantTable>(table: T, values: Omit<T["$inferInsert"], "companyId">): Promise<T["$inferSelect"][]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = { ...(values as any), companyId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await db.insert(table as any).values(row).returning()) as T["$inferSelect"][];
    },

    /** Insère plusieurs lignes pour l'entreprise : company_id est imposé sur chacune. */
    async insertMany<T extends TenantTable>(
      table: T,
      values: Omit<T["$inferInsert"], "companyId">[],
    ): Promise<T["$inferSelect"][]> {
      if (values.length === 0) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = values.map((v) => ({ ...(v as any), companyId }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await db.insert(table as any).values(rows).returning()) as T["$inferSelect"][];
    },

    /** Met à jour les lignes de l'entreprise ; company_id ne change jamais. */
    async update<T extends TenantTable>(
      table: T,
      set: Partial<Omit<T["$inferInsert"], "companyId">>,
      ...extra: Extra[]
    ): Promise<T["$inferSelect"][]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { companyId: _ignored, ...safe } = set as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await db.update(table as any).set(safe).where(filter(table, ...extra)).returning()) as T["$inferSelect"][];
    },

    /**
     * Pour les tables rattachées à une livraison (tentatives, QR, OTP, retours…),
     * qui n'ont pas de company_id propre : « la livraison est à l'entreprise ».
     */
    ofOwnDelivery(deliveryIdColumn: AnyPgColumn): SQL {
      return inArray(deliveryIdColumn, deliveryIds());
    },
  };
}

export type TenantScope = ReturnType<typeof tenantScope>;
