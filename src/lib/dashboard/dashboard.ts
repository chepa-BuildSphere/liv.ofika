import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { couriers, deliveries, manualOverrides, securityAlerts, users } from "@/db/schema";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { logEvent, type Executor } from "@/lib/audit";
import { tenantScope } from "@/lib/tenant/scope";

export type CompanyDashboardMetrics = {
  total: number;
  created: number;
  assigned: number;
  inTransit: number; // PICKED_UP + ARRIVED
  deliveredQr: number; // DELIVERED avec preuve normale
  deliveredForced: number; // DELIVERED avec preuve manuelle (MANUAL)
  deliveredTotal: number;
  failed: number; // DELIVERY_FAILED
  returning: number; // RETURNING
  returnReceived: number; // RETURN_RECEIVED
  cancelled: number; // CANCELLED
  successRatePercent: number;
};

export type DashboardCourierSummary = {
  courierId: string;
  name: string;
  phone: string;
  assigned: number;
  pickedUp: number;
  deliveredQr: number;
  deliveredForced: number;
  failed: number;
  returning: number;
  returnReceived: number;
  isSettled: boolean;
};

export type DashboardUnreceivedReturn = {
  deliveryId: string;
  reference: string;
  recipientAddress: string;
  courierId: string | null;
  courierName: string | null;
  courierPhone: string | null;
  failedReason: string | null;
  updatedAt: Date;
  hoursElapsed: number;
};

export type DashboardForcedDelivery = {
  deliveryId: string;
  reference: string;
  recipientAddress: string;
  courierName: string | null;
  forcedByName: string | null;
  forcedReason: string | null;
  forcedAt: Date;
};

export type DashboardSecurityAlert = {
  id: string;
  type: string;
  courierId: string | null;
  courierName: string | null;
  deliveryId: string | null;
  deliveryReference: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
};

export type CompanyDashboardData = {
  companyId: string;
  date: string; // ISO date YYYY-MM-DD
  isToday: boolean;
  metrics: CompanyDashboardMetrics;
  courierSummaries: DashboardCourierSummary[];
  unreceivedReturns: DashboardUnreceivedReturn[];
  forcedDeliveries: DashboardForcedDelivery[];
  securityAlerts: DashboardSecurityAlert[];
};

export type GetCompanyDashboardOptions = {
  date?: string; // Format YYYY-MM-DD (fuseau UTC/GMT)
  includeTest?: boolean;
};

/**
 * Calcule les métriques globales et l'activité du tableau de bord entreprise.
 * Cloisonnement strict sur company_id (mvp.md §4.2, §10, tâche 8.1).
 */
export async function getCompanyDashboard(
  actor: Actor,
  companyId: string,
  options: GetCompanyDashboardOptions = {},
  tx: Executor = db,
): Promise<CompanyDashboardData> {
  // L'utilisateur doit appartenir à l'entreprise
  if (actor.kind === "user") {
    if (actor.companyId !== companyId) {
      throw new Error("Accès refusé : ressource d'une autre entreprise");
    }
  } else if (actor.kind !== "platformAdmin") {
    throw new Error("Accès réservé aux utilisateurs d'entreprise");
  }

  // Calcul des bornes de la journée en UTC (Côte d'Ivoire = UTC+0)
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDateStr = options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : todayStr;
  const isToday = targetDateStr === todayStr;

  const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  // 1. Livraisons de la journée ou actives pour le calcul des métriques
  const rows = await tx
    .select({
      id: deliveries.id,
      status: deliveries.status,
      proofMethod: deliveries.proofMethod,
      courierId: deliveries.courierId,
      courierName: couriers.name,
      courierPhone: couriers.phone,
      isTest: deliveries.isTest,
      createdAt: deliveries.createdAt,
      updatedAt: deliveries.updatedAt,
    })
    // tenant-guard: tableau de bord entreprise filtre explicitement par company_id
    .from(deliveries)
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .where(
      and(
        eq(deliveries.companyId, companyId),
        options.includeTest ? sql`true` : eq(deliveries.isTest, false),
        // Livraisons créées ce jour-là, ou actives ce jour-là
        sql`(${deliveries.createdAt} >= ${startOfDay} AND ${deliveries.createdAt} <= ${endOfDay}) OR (${deliveries.status} IN ('ASSIGNED', 'PICKED_UP', 'ARRIVED', 'RETURNING'))`,
      ),
    );

  // Initialisation des compteurs
  let created = 0;
  let assigned = 0;
  let inTransit = 0;
  let deliveredQr = 0;
  let deliveredForced = 0;
  let failed = 0;
  let returning = 0;
  let returnReceived = 0;
  let cancelled = 0;

  // Regroupement par livreur pour le tableau du jour
  const couriersMap = new Map<
    string,
    {
      courierId: string;
      name: string;
      phone: string;
      assigned: number;
      pickedUp: number;
      deliveredQr: number;
      deliveredForced: number;
      failed: number;
      returning: number;
      returnReceived: number;
    }
  >();

  for (const row of rows) {
    // Ventilation statut
    switch (row.status) {
      case "CREATED":
        created++;
        break;
      case "ASSIGNED":
        assigned++;
        break;
      case "PICKED_UP":
      case "ARRIVED":
        inTransit++;
        break;
      case "DELIVERED":
        if (row.proofMethod === "MANUAL") {
          deliveredForced++;
        } else {
          deliveredQr++;
        }
        break;
      case "DELIVERY_FAILED":
        failed++;
        break;
      case "RETURNING":
        returning++;
        break;
      case "RETURN_RECEIVED":
        returnReceived++;
        break;
      case "CANCELLED":
        cancelled++;
        break;
    }

    // Activité par livreur (si un livreur est affecté)
    if (row.courierId && row.courierName) {
      let entry = couriersMap.get(row.courierId);
      if (!entry) {
        entry = {
          courierId: row.courierId,
          name: row.courierName,
          phone: row.courierPhone ?? "",
          assigned: 0,
          pickedUp: 0,
          deliveredQr: 0,
          deliveredForced: 0,
          failed: 0,
          returning: 0,
          returnReceived: 0,
        };
        couriersMap.set(row.courierId, entry);
      }

      switch (row.status) {
        case "ASSIGNED":
          entry.assigned++;
          break;
        case "PICKED_UP":
        case "ARRIVED":
          entry.pickedUp++;
          break;
        case "DELIVERED":
          if (row.proofMethod === "MANUAL") {
            entry.deliveredForced++;
          } else {
            entry.deliveredQr++;
          }
          break;
        case "DELIVERY_FAILED":
          entry.failed++;
          break;
        case "RETURNING":
          entry.returning++;
          break;
        case "RETURN_RECEIVED":
          entry.returnReceived++;
          break;
      }
    }
  }

  const deliveredTotal = deliveredQr + deliveredForced;
  const terminalOutcomes = deliveredTotal + returnReceived + failed;
  const successRatePercent = terminalOutcomes > 0 ? Math.round((deliveredTotal / terminalOutcomes) * 100) : 0;

  const courierSummaries: DashboardCourierSummary[] = Array.from(couriersMap.values()).map((c) => {
    // Un livreur est soldé si tous ses colis pris sont terminés (livrés ou retours réceptionnés)
    const active = c.assigned + c.pickedUp + c.returning + c.failed;
    return {
      ...c,
      isSettled: active === 0,
    };
  });

  // 2. Retours non réceptionnés (Point d'attention critique)
  // Tous les colis en statut RETURNING pour l'entreprise
  const unreceivedReturnRows = await tx
    .select({
      deliveryId: deliveries.id,
      reference: deliveries.reference,
      address: deliveries.address,
      courierId: deliveries.courierId,
      courierName: couriers.name,
      courierPhone: couriers.phone,
      updatedAt: deliveries.updatedAt,
    })
    // tenant-guard: sélection des retours en attente filtrée par company_id
    .from(deliveries)
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .where(
      and(
        eq(deliveries.companyId, companyId),
        eq(deliveries.status, "RETURNING"),
        options.includeTest ? sql`true` : eq(deliveries.isTest, false),
      ),
    )
    .orderBy(desc(deliveries.updatedAt))
    .limit(20);

  const nowMs = Date.now();
  const unreceivedReturns: DashboardUnreceivedReturn[] = unreceivedReturnRows.map((r) => {
    const hoursElapsed = Math.max(0, Math.floor((nowMs - r.updatedAt.getTime()) / (1000 * 60 * 60)));
    return {
      deliveryId: r.deliveryId,
      reference: r.reference,
      recipientAddress: r.address,
      courierId: r.courierId,
      courierName: r.courierName,
      courierPhone: r.courierPhone,
      failedReason: null,
      updatedAt: r.updatedAt,
      hoursElapsed,
    };
  });

  // 3. Livraisons forcées récentes (surveillance des abus)
  const forcedRows = await tx
    .select({
      deliveryId: deliveries.id,
      reference: deliveries.reference,
      address: deliveries.address,
      courierName: couriers.name,
      forcedByName: users.name,
      forcedReason: manualOverrides.reason,
      forcedAt: manualOverrides.createdAt,
      updatedAt: deliveries.updatedAt,
    })
    // tenant-guard: sélection des livraisons forcées filtrée par company_id
    .from(deliveries)
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .leftJoin(manualOverrides, eq(deliveries.id, manualOverrides.deliveryId))
    // tenant-guard: jointure users pour l'auteur de la livraison forcée
    .leftJoin(users, eq(manualOverrides.userId, users.id))
    .where(
      and(
        eq(deliveries.companyId, companyId),
        eq(deliveries.status, "DELIVERED"),
        eq(deliveries.proofMethod, "MANUAL"),
        options.includeTest ? sql`true` : eq(deliveries.isTest, false),
      ),
    )
    .orderBy(desc(deliveries.updatedAt))
    .limit(10);

  const forcedDeliveries: DashboardForcedDelivery[] = forcedRows.map((f) => ({
    deliveryId: f.deliveryId,
    reference: f.reference,
    recipientAddress: f.address,
    courierName: f.courierName,
    forcedByName: f.forcedByName ?? "Administrateur",
    forcedReason: f.forcedReason ?? "Validation manuelle consignée",
    forcedAt: f.forcedAt ?? f.updatedAt,
  }));

  // 4. Alertes de sécurité actives (non résolues)
  const alertRows = await tx
    .select({
      id: securityAlerts.id,
      type: securityAlerts.type,
      courierId: securityAlerts.courierId,
      courierName: couriers.name,
      deliveryId: securityAlerts.deliveryId,
      deliveryReference: deliveries.reference,
      details: securityAlerts.details,
      createdAt: securityAlerts.createdAt,
    })
    // tenant-guard: alertes de sécurité non résolues filtrées par company_id
    .from(securityAlerts)
    .leftJoin(couriers, eq(securityAlerts.courierId, couriers.id))
    // tenant-guard: jointure de la référence livraison liée à l'alerte
    .leftJoin(deliveries, eq(securityAlerts.deliveryId, deliveries.id))
    .where(
      and(
        eq(securityAlerts.companyId, companyId),
        isNull(securityAlerts.resolvedAt),
      ),
    )
    .orderBy(desc(securityAlerts.createdAt))
    .limit(10);

  const securityAlertsList: DashboardSecurityAlert[] = alertRows.map((a) => ({
    id: a.id,
    type: a.type,
    courierId: a.courierId,
    courierName: a.courierName,
    deliveryId: a.deliveryId,
    deliveryReference: a.deliveryReference,
    details: a.details as Record<string, unknown> | null,
    createdAt: a.createdAt,
  }));

  return {
    companyId,
    date: targetDateStr,
    isToday,
    metrics: {
      total: rows.length,
      created,
      assigned,
      inTransit,
      deliveredQr,
      deliveredForced,
      deliveredTotal,
      failed,
      returning,
      returnReceived,
      cancelled,
      successRatePercent,
    },
    courierSummaries,
    unreceivedReturns,
    forcedDeliveries,
    securityAlerts: securityAlertsList,
  };
}

/**
 * Résout une alerte de sécurité (réservé COMPANY_ADMIN).
 */
export async function resolveSecurityAlert(
  actor: Actor,
  alertId: string,
  notes?: string,
  tx: Executor = db,
): Promise<{ success: true }> {
  if (actor.kind !== "user") {
    throw new Error("Seul un utilisateur d'entreprise peut résoudre une alerte");
  }
  assertCan(actor, "company.manageUsers", { companyId: actor.companyId });

  const run = async (t: Executor) => {
    // Vérifier que l'alerte appartient à l'entreprise
    const [alert] = await t
      .select({ id: securityAlerts.id, companyId: securityAlerts.companyId, type: securityAlerts.type })
      // tenant-guard: vérification de l'alerte par company_id
      .from(securityAlerts)
      .where(and(eq(securityAlerts.id, alertId), eq(securityAlerts.companyId, actor.companyId)))
      .limit(1);

    if (!alert) {
      throw new Error("Alerte de sécurité introuvable ou déjà traitée");
    }

    await tenantScope(t, actor.companyId).update(
      securityAlerts,
      {
        resolvedAt: new Date(),
        resolvedByUserId: actor.id,
        details: sql`jsonb_set(COALESCE(${securityAlerts.details}, '{}'::jsonb), '{resolutionNotes}', ${JSON.stringify(notes ?? "Résolue par l'administrateur")}::jsonb)`,
      },
      eq(securityAlerts.id, alertId),
    );

    await logEvent(t, {
      companyId: actor.companyId,
      deliveryId: null,
      eventType: "SECURITY_ALERT_RESOLVED",
      actorType: "USER",
      actorId: actor.id,
      fromStatus: null,
      toStatus: null,
      payload: {
        alertId,
        alertType: alert.type,
        resolvedByUserId: actor.id,
        notes: notes ?? null,
      },
    });
  };

  if (tx === db) {
    await db.transaction(run);
  } else {
    await run(tx);
  }

  return { success: true };
}
