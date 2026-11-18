import { and, desc, eq, sql } from "drizzle-orm";
import { cashHandovers, couriers, deliveries, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { assertCan, can, type Actor } from "@/lib/auth/permissions";
import { DeliveryError, UUID_RE } from "@/lib/deliveries/errors";
import { tenantScope } from "@/lib/tenant/scope";

export type PaymentMethodType =
  | "CASH"
  | "WAVE"
  | "ORANGE_MONEY"
  | "MTN_MOMO"
  | "MOOV_MONEY"
  | "OTHER";

export type CourierCashOverview = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  totalDeliveriesWithCod: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
  totalCashCollected: number;
  totalDigitalCollected: number;
  totalAlreadyHandedOver: number;
  pendingCashOnHand: number;
};

/**
 * Calcule la situation de caisse d'un livreur (somme des espèces encaissées non encore remises).
 */
export async function getCourierCashOverview(
  db: Executor,
  companyId: string,
  courierId: string,
): Promise<CourierCashOverview> {
  if (!UUID_RE.test(courierId)) {
    throw new DeliveryError("NOT_FOUND", "Livreur introuvable.");
  }

  // 1. Infos du livreur
  const [courier] = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      phone: couriers.phone,
    })
    .from(couriers)
    .where(eq(couriers.id, courierId))
    .limit(1);

  if (!courier) {
    throw new DeliveryError("NOT_FOUND", "Livreur introuvable.");
  }

  // 2. Livraisons livrées avec encaissement
  const codDeliveries = await db
    .select({
      id: deliveries.id,
      amountToCollect: deliveries.amountToCollect,
      amountCollected: deliveries.amountCollected,
      paymentMethod: deliveries.paymentMethod,
    })
    .from(deliveries)
    .where(
      tenantScope(db, companyId).filter(
        deliveries,
        eq(deliveries.courierId, courierId),
        eq(deliveries.status, "DELIVERED"),
        eq(deliveries.isTest, false),
      ),
    );

  let totalExpected = 0;
  let totalCollected = 0;
  let totalCash = 0;
  let totalDigital = 0;

  for (const d of codDeliveries) {
    if (d.amountToCollect != null && d.amountToCollect > 0) {
      totalExpected += d.amountToCollect;
    }
    if (d.amountCollected != null && d.amountCollected > 0) {
      totalCollected += d.amountCollected;
      if (d.paymentMethod === "CASH") {
        totalCash += d.amountCollected;
      } else if (d.paymentMethod != null) {
        totalDigital += d.amountCollected;
      }
    }
  }

  // 3. Somme des remises d'espèces déjà enregistrées
  const [handoverSum] = await db
    .select({
      totalHanded: sql<number>`coalesce(sum(${cashHandovers.handedOverAmount}), 0)::int`,
    })
    .from(cashHandovers)
    .where(
      tenantScope(db, companyId).filter(
        cashHandovers,
        eq(cashHandovers.courierId, courierId),
      ),
    );

  const totalAlreadyHandedOver = handoverSum?.totalHanded ?? 0;
  const pendingCashOnHand = Math.max(0, totalCash - totalAlreadyHandedOver);

  return {
    courierId: courier.id,
    courierName: courier.name,
    courierPhone: courier.phone,
    totalDeliveriesWithCod: codDeliveries.length,
    totalExpectedAmount: totalExpected,
    totalCollectedAmount: totalCollected,
    totalCashCollected: totalCash,
    totalDigitalCollected: totalDigital,
    totalAlreadyHandedOver,
    pendingCashOnHand,
  };
}

export type ReconcileCashInput = {
  companyId: string;
  courierId: string;
  handedOverAmount: number;
  notes?: string | null;
};

/**
 * Enregistre une remise physique d'espèces par le livreur au dépôt avec calcul d'écart.
 * Émet l'événement CASH_HANDED_OVER dans le journal d'audit.
 */
export async function reconcileCashHandover(
  db: Executor,
  actor: Actor,
  input: ReconcileCashInput,
) {
  assertCan(actor, "cash.reconcile", { companyId: input.companyId });

  if (input.handedOverAmount < 0) {
    throw new DeliveryError("INVALID", "Le montant remis doit être supérieur ou égal à zéro.");
  }

  return db.transaction(async (tx) => {
    const overview = await getCourierCashOverview(tx, input.companyId, input.courierId);
    const expectedAmount = overview.pendingCashOnHand;
    const discrepancy = input.handedOverAmount - expectedAmount;

    const [record] = await tenantScope(tx, input.companyId).insert(cashHandovers, {
      courierId: input.courierId,
      expectedAmount,
      handedOverAmount: input.handedOverAmount,
      discrepancy,
      receivedByUserId: actor.id,
      notes: input.notes?.trim() || null,
    });

    await logEvent(tx, {
      companyId: input.companyId,
      deliveryId: null,
      eventType: "CASH_HANDED_OVER",
      actorType: "USER",
      actorId: actor.id,
      fromStatus: null,
      toStatus: null,
      payload: {
        handoverId: record.id,
        courierId: input.courierId,
        expectedAmount,
        handedOverAmount: input.handedOverAmount,
        discrepancy,
        notes: input.notes?.trim() || null,
      },
    });

    return {
      ok: true as const,
      handover: record,
      discrepancy,
    };
  });
}

/**
 * Liste l'historique des remises d'espèces d'une entreprise.
 */
export async function listCompanyCashHandovers(
  db: Executor,
  actor: Actor,
  companyId: string,
) {
  assertCan(actor, "cash.viewHandovers", { companyId });

  return db
    .select({
      id: cashHandovers.id,
      companyId: cashHandovers.companyId,
      courierId: cashHandovers.courierId,
      courierName: couriers.name,
      courierPhone: couriers.phone,
      expectedAmount: cashHandovers.expectedAmount,
      handedOverAmount: cashHandovers.handedOverAmount,
      discrepancy: cashHandovers.discrepancy,
      receivedByUserId: cashHandovers.receivedByUserId,
      receivedByUserName: users.name,
      notes: cashHandovers.notes,
      createdAt: cashHandovers.createdAt,
    })
    .from(cashHandovers)
    .innerJoin(couriers, eq(cashHandovers.courierId, couriers.id))
    .innerJoin(users, eq(cashHandovers.receivedByUserId, users.id))
    .where(tenantScope(db, companyId).filter(cashHandovers))
    .orderBy(desc(cashHandovers.createdAt));
}
