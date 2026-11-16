import { and, eq } from "drizzle-orm";
import { companies, deliveries, deliveryAttempts } from "@/db/schema";
import { logEvent, type AuditEventInput, type Executor } from "@/lib/audit";
import { tenantScope } from "@/lib/tenant/scope";
import { enqueueDeliveryWebhookEvent, webhookEventForStatus } from "@/lib/webhooks/webhooks";
import { checkTransition, type DeliveryStatus, type TransitionError, type TransitionOptions } from "./transitions";

export class TransitionRefused extends Error {
  constructor(
    readonly code: TransitionError | "NOT_FOUND" | "STALE",
    message: string,
  ) {
    super(message);
    this.name = "TransitionRefused";
  }
}

export type ChangeStatusInput = TransitionOptions & {
  /** Entreprise de l'acteur : une livraison d'une autre entreprise est « introuvable ». */
  companyId: string;
  deliveryId: string;
  to: DeliveryStatus;
  actor: Pick<AuditEventInput, "actorType" | "actorId">;
  /** Si fourni : refus si le statut a changé entre-temps (double clic, deux onglets). */
  expectedFrom?: DeliveryStatus;
  /** Nouveau livreur, pour ASSIGNED. */
  courierId?: string;
  /** Contexte enregistré dans l'audit (GPS, IP, détails). */
  context?: Pick<AuditEventInput, "lat" | "lng" | "accuracy" | "ip" | "userAgent" | "payload">;
};

/**
 * Seul point d'entrée pour changer le statut d'une livraison.
 * Dans une même transaction : verrouille la ligne, vérifie la transition,
 * met à jour la livraison et ajoute l'événement au journal d'audit.
 * Tout ou rien : si l'audit échoue, le statut n'a pas changé.
 */
export async function changeDeliveryStatus(executor: Executor, input: ChangeStatusInput) {
  return executor.transaction(async (tx) => {
    // FOR UPDATE : deux changements simultanés sur le même colis passent l'un après l'autre
    const [current] = await tx
      .select({
        id: deliveries.id,
        companyId: deliveries.companyId,
        isTest: deliveries.isTest,
        status: deliveries.status,
        courierId: deliveries.courierId,
        currentAttempt: deliveries.currentAttempt,
      })
      .from(deliveries)
      .where(tenantScope(tx, input.companyId).filter(deliveries, eq(deliveries.id, input.deliveryId)))
      .for("update");

    if (!current) throw new TransitionRefused("NOT_FOUND", "Livraison introuvable");

    if (input.expectedFrom && input.expectedFrom !== current.status) {
      throw new TransitionRefused(
        "STALE",
        `Le statut a changé entre-temps (${current.status}, attendu ${input.expectedFrom})`,
      );
    }

    const check = checkTransition(current.status, input.to, input);
    if (!check.ok) throw new TransitionRefused(check.code, check.message);

    if (input.to === "ASSIGNED" && !input.courierId) {
      throw new TransitionRefused("NOT_ALLOWED", "Un livreur est obligatoire pour affecter la livraison");
    }

    const now = new Date();
    const changes: Partial<typeof deliveries.$inferInsert> = { status: input.to, updatedAt: now };
    switch (input.to) {
      case "ASSIGNED":
        changes.courierId = input.courierId;
        changes.assignedAt = now;
        break;
      case "CREATED": // désaffectation
        changes.courierId = null;
        changes.assignedAt = null;
        break;
      case "PICKED_UP":
        changes.pickedUpAt = now;
        break;
      case "ARRIVED": {
        const nextAttempt = current.currentAttempt + 1;
        changes.currentAttempt = nextAttempt;
        if (current.courierId) {
          await tx.insert(deliveryAttempts).values({
            deliveryId: current.id,
            courierId: current.courierId,
            attemptNumber: nextAttempt,
            outcome: "IN_PROGRESS",
            arrivedAt: now,
            arrivedLat: input.context?.lat ?? null,
            arrivedLng: input.context?.lng ?? null,
            arrivedAccuracy: input.context?.accuracy ?? null,
          });
        }
        break;
      }
      case "DELIVERED": {
        changes.proofMethod = input.proofMethod;
        changes.deliveredAt = now;
        const [company] = await tx
          .select({
            billingEnabled: companies.billingEnabled,
            pricePerDelivery: companies.pricePerDelivery,
          })
          .from(companies)
          .where(eq(companies.id, current.companyId))
          .limit(1);
        changes.billedPrice = current.isTest
          ? null
          : company?.billingEnabled
            ? company.pricePerDelivery
            : 0;
        if (current.currentAttempt > 0) {
          await tx
            .update(deliveryAttempts)
            .set({ outcome: "DELIVERED" })
            .where(
              and(
                eq(deliveryAttempts.deliveryId, current.id),
                eq(deliveryAttempts.attemptNumber, current.currentAttempt),
              ),
            );
        }
        break;
      }
      case "DELIVERY_FAILED":
        if (current.currentAttempt > 0) {
          await tx
            .update(deliveryAttempts)
            .set({
              outcome: "FAILED",
              failedAt: now,
              failedLat: input.context?.lat ?? null,
              failedLng: input.context?.lng ?? null,
            })
            .where(
              and(
                eq(deliveryAttempts.deliveryId, current.id),
                eq(deliveryAttempts.attemptNumber, current.currentAttempt),
              ),
            );
        }
        break;
      case "CANCELLED":
        changes.cancelledAt = now;
        break;
    }

    const [updated] = await tenantScope(tx, input.companyId).update(deliveries, changes, eq(deliveries.id, current.id));

    await logEvent(tx, {
      companyId: current.companyId,
      deliveryId: current.id,
      eventType: check.forced ? "DELIVERY_FORCED_DELIVERED" : `DELIVERY_${input.to}`,
      actorType: input.actor.actorType,
      actorId: input.actor.actorId ?? null,
      fromStatus: current.status,
      toStatus: input.to,
      payload: {
        ...(input.context?.payload as object | undefined),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.proofMethod ? { proofMethod: input.proofMethod } : {}),
        ...(input.to === "DELIVERED" ? { billedPrice: changes.billedPrice ?? null } : {}),
        ...(input.to === "ASSIGNED" ? { courierId: input.courierId, previousCourierId: current.courierId } : {}),
        ...(input.to === "ARRIVED"
          ? {
              attemptNumber: changes.currentAttempt,
              gpsMissing: input.context?.lat == null || input.context?.lng == null,
            }
          : {}),
      },
      lat: input.context?.lat,
      lng: input.context?.lng,
      accuracy: input.context?.accuracy,
      ip: input.context?.ip,
      userAgent: input.context?.userAgent,
    });

    const webhookEvent = webhookEventForStatus(current.status, input.to);
    if (webhookEvent) {
      const payloadObj =
        input.context?.payload &&
        typeof input.context.payload === "object" &&
        !Array.isArray(input.context.payload)
          ? (input.context.payload as Record<string, unknown>)
          : null;
      const failureReason =
        webhookEvent === "delivery.failed"
          ? typeof payloadObj?.failureReason === "string"
            ? payloadObj.failureReason
            : (input.reason ?? null)
          : null;

      await enqueueDeliveryWebhookEvent(tx, {
        companyId: current.companyId,
        eventType: webhookEvent,
        delivery: updated,
        failureReason,
        occurredAt: now,
      });
    }

    return updated;
  });
}

// Garde-fou de type : le statut en base et celui des règles restent alignés.
type _Aligned = typeof deliveries.$inferSelect.status extends DeliveryStatus ? true : never;
const _aligned: _Aligned = true;
void _aligned;
