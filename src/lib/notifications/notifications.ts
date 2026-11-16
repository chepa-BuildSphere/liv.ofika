import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, deliveries, users } from "@/db/schema";
import type { Executor } from "@/lib/audit";

export type InAppNotificationSeverity = "success" | "warning" | "danger" | "info";

export type InAppNotification = {
  id: string;
  type: "DELIVERED" | "DELIVERED_FORCED" | "FAILED" | "RETURNING" | "RETURN_RECEIVED" | "SECURITY_ALERT";
  title: string;
  description: string;
  severity: InAppNotificationSeverity;
  timestamp: Date;
  deliveryId: string | null;
  reference: string | null;
  actorName: string | null;
};

const NOTIFIABLE_EVENTS = [
  "DELIVERY_DELIVERED",
  "DELIVERY_FORCED_DELIVERED",
  "DELIVERY_FAILED",
  "DELIVERY_RETURNING",
  "DELIVERY_RETURN_RECEIVED",
  "SUSPICIOUS_DEVICE_REUSE",
] as const;

/**
 * Récupère les notifications récentes dans l'interface pour l'admin et le marchand.
 * S'appuie sur le journal d'audit append-only de l'entreprise (mvp.md §6.3 étape 14, tâche 8.3).
 */
export async function getRecentNotifications(
  companyId: string,
  limit = 20,
  tx: Executor = db,
): Promise<InAppNotification[]> {
  // tenant-guard: flux des notifications d'entreprise extrait d'audit_events filtré par company_id
  const events = await tx
    .select({
      id: auditEvents.id,
      eventType: auditEvents.eventType,
      actorType: auditEvents.actorType,
      actorId: auditEvents.actorId,
      deliveryId: auditEvents.deliveryId,
      payload: auditEvents.payload,
      serverTime: auditEvents.serverTime,
      deliveryReference: deliveries.reference,
    })
    // tenant-guard: auditEvents filtré par company_id
    .from(auditEvents)
    // tenant-guard: jointure facultative sur la livraison liée à l'événement
    .leftJoin(deliveries, eq(auditEvents.deliveryId, deliveries.id))
    .where(
      and(
        eq(auditEvents.companyId, companyId),
        inArray(auditEvents.eventType, NOTIFIABLE_EVENTS as unknown as string[]),
      ),
    )
    .orderBy(desc(auditEvents.serverTime))
    .limit(limit);

  return events.map((ev) => {
    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    const ref = ev.deliveryReference ?? (payload.reference as string | undefined) ?? "Colis";

    switch (ev.eventType) {
      case "DELIVERY_FORCED_DELIVERED": {
        return {
          id: String(ev.id),
          type: "DELIVERED_FORCED",
          title: `Livré (forcé) : ${ref}`,
          description: String(payload.reason ?? "Validation manuelle consignée par l'administrateur"),
          severity: "warning",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: "Administrateur",
        };
      }

      case "DELIVERY_DELIVERED": {
        const isForced = payload.proofMethod === "MANUAL";
        if (isForced) {
          return {
            id: String(ev.id),
            type: "DELIVERED_FORCED",
            title: `Livré (forcé) : ${ref}`,
            description: String(payload.reason ?? "Validation manuelle consignée par l'administrateur"),
            severity: "warning",
            timestamp: ev.serverTime,
            deliveryId: ev.deliveryId,
            reference: ev.deliveryReference,
            actorName: "Administrateur",
          };
        }
        return {
          id: String(ev.id),
          type: "DELIVERED",
          title: `Colis livré : ${ref}`,
          description: "Remise validée par QR code et code client à 4 chiffres.",
          severity: "success",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: "Livreur & Client",
        };
      }

      case "DELIVERY_FAILED": {
        const reason = (payload.reason as string) ?? "Échec de livraison déclaré par le livreur";
        return {
          id: String(ev.id),
          type: "FAILED",
          title: `Échec de livraison : ${ref}`,
          description: `Motif : ${reason}`,
          severity: "danger",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: "Livreur",
        };
      }

      case "DELIVERY_RETURNING": {
        return {
          id: String(ev.id),
          type: "RETURNING",
          title: `Retour en cours : ${ref}`,
          description: "Le livreur a initié le retour du colis vers le dépôt de l'entreprise.",
          severity: "warning",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: "Livreur",
        };
      }

      case "DELIVERY_RETURN_RECEIVED": {
        return {
          id: String(ev.id),
          type: "RETURN_RECEIVED",
          title: `Retour réceptionné : ${ref}`,
          description: "Le colis a été réceptionné et contrôlé au dépôt.",
          severity: "info",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: "Dépôt",
        };
      }

      case "SUSPICIOUS_DEVICE_REUSE": {
        return {
          id: String(ev.id),
          type: "SECURITY_ALERT",
          title: `Alerte sécurité : Même appareil client réutilisé`,
          description: `Le même smartphone a validé plusieurs livraisons distinctes pour le même livreur.`,
          severity: "danger",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: "Système de sécurité",
        };
      }

      default:
        return {
          id: String(ev.id),
          type: "DELIVERED",
          title: `Événement : ${ref}`,
          description: ev.eventType,
          severity: "info",
          timestamp: ev.serverTime,
          deliveryId: ev.deliveryId,
          reference: ev.deliveryReference,
          actorName: null,
        };
    }
  });
}
