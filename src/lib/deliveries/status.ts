import { eq } from "drizzle-orm";
import { deliveries } from "@/db/schema";
import { logEvent, type AuditEventInput, type Executor } from "@/lib/audit";
import { tenantScope } from "@/lib/tenant/scope";
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
        status: deliveries.status,
        courierId: deliveries.courierId,
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
      case "DELIVERED":
        changes.proofMethod = input.proofMethod;
        changes.deliveredAt = now;
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
        ...(input.to === "ASSIGNED" ? { courierId: input.courierId, previousCourierId: current.courierId } : {}),
      },
      lat: input.context?.lat,
      lng: input.context?.lng,
      accuracy: input.context?.accuracy,
      ip: input.context?.ip,
      userAgent: input.context?.userAgent,
    });

    return updated;
  });
}

// Garde-fou de type : le statut en base et celui des règles restent alignés.
type _Aligned = typeof deliveries.$inferSelect.status extends DeliveryStatus ? true : never;
const _aligned: _Aligned = true;
void _aligned;
