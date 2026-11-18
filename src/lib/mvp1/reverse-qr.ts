import { and, eq } from "drizzle-orm";
import { deliveries } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CourierIdentity } from "@/lib/auth/courier";
import { can, courierActor } from "@/lib/auth/permissions";
import { DeliveryError, normalizeGpsCoords, UUID_RE, type GpsCoordsInput } from "@/lib/deliveries/errors";
import { changeDeliveryStatus } from "@/lib/deliveries/status";
import { renderQrSvg } from "@/lib/qr/qr-matrix";
import { hashToken, randomToken } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import { getProofModeRequirements, validateProofRequirements } from "./proof-levels";

export type ReverseQrPayload = {
  token: string;
  payloadString: string;
  qrSvg: string;
};

export function buildReverseQrPayload(reference: string, token: string): string {
  return `OFIKA-REV:${reference.trim()}:${token.trim()}`;
}

export function parseReverseQrPayload(raw: string): { reference: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("OFIKA-REV:")) return null;
  const parts = trimmed.split(":");
  if (parts.length < 3) return null;
  return {
    reference: parts[1],
    token: parts.slice(2).join(":"),
  };
}

/**
 * Génère ou récupère le jeton QR inversé pour le destinataire.
 */
export async function issueReverseQrToken(
  db: Executor,
  companyId: string,
  deliveryId: string,
): Promise<ReverseQrPayload> {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: deliveries.id,
        companyId: deliveries.companyId,
        reference: deliveries.reference,
        reverseQrTokenHash: deliveries.reverseQrTokenHash,
      })
      .from(deliveries)
      .where(tenantScope(tx, companyId).filter(deliveries, eq(deliveries.id, deliveryId)))
      .for("update")
      .limit(1);

    if (!row) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const token = randomToken(16);
    const tokenHash = hashToken(token);
    const now = new Date();

    await tenantScope(tx, companyId).update(
      deliveries,
      {
        reverseQrTokenHash: tokenHash,
        reverseQrGeneratedAt: now,
        updatedAt: now,
      },
      eq(deliveries.id, deliveryId),
    );

    const payloadString = buildReverseQrPayload(row.reference, token);
    const qrSvg = renderQrSvg(payloadString, { moduleSize: 6, margin: 4 });

    return {
      token,
      payloadString,
      qrSvg,
    };
  });
}

export type VerifyReverseQrInput = {
  deliveryId: string;
  scannedPayload: string;
  gps?: GpsCoordsInput | null;
  ip?: string | null;
  userAgent?: string | null;
  photoUrl?: string | null;
  signatureUrl?: string | null;
  recipientName?: string | null;
  amountCollected?: number | null;
  paymentMethod?: "CASH" | "WAVE" | "ORANGE_MONEY" | "MTN_MOMO" | "MOOV_MONEY" | "OTHER" | null;
  paymentReference?: string | null;
};

/**
 * Le livreur scanne le QR code présenté par le destinataire (Option B).
 */
export async function verifyReverseQrHandover(
  db: Executor,
  courier: CourierIdentity,
  input: VerifyReverseQrInput,
) {
  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const parsed = parseReverseQrPayload(input.scannedPayload);
  if (!parsed) {
    throw new DeliveryError("INVALID", "Le format du QR code scanné est invalide pour Ofika Delivery.");
  }

  const tokenHash = hashToken(parsed.token);
  const coords = normalizeGpsCoords(input.gps);

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérification via can(courierActor(courier), "delivery.enterHandoverCode", ...)
    const [delivery] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, input.deliveryId), eq(deliveries.isTest, false)))
      .for("update")
      .limit(1);

    if (!delivery) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(courierActor(courier), "delivery.enterHandoverCode", {
      companyId: delivery.companyId,
      status: delivery.status,
      courierId: delivery.courierId,
    });
    if (!decision.allowed) {
      throw new DeliveryError("FORBIDDEN", "Vous n'êtes pas autorisé à valider cette livraison.");
    }

    if (delivery.status !== "ARRIVED") {
      throw new DeliveryError("INVALID", "La livraison doit être au statut « Arrivé » pour scanner le QR.");
    }

    if (!delivery.reverseQrTokenHash || delivery.reverseQrTokenHash !== tokenHash) {
      throw new DeliveryError("INVALID", "Le QR code scanné ne correspond pas à cette commande.");
    }

    // Vérifier les exigences de preuve MVP 1 (photo, signature)
    const proofValidation = validateProofRequirements(delivery.proofMode, {
      photoUrl: input.photoUrl,
      signatureUrl: input.signatureUrl,
    });
    if (!proofValidation.valid) {
      throw new DeliveryError("INVALID", proofValidation.error ?? "Preuve incomplète.");
    }

    const req = getProofModeRequirements(delivery.proofMode);

    await logEvent(tx, {
      companyId: delivery.companyId,
      deliveryId: delivery.id,
      eventType: "REVERSE_QR_SCANNED",
      actorType: "COURIER",
      actorId: courier.id,
      fromStatus: delivery.status,
      toStatus: "DELIVERED",
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      payload: {
        method: "REVERSE_QR",
        reference: delivery.reference,
        hasPhoto: Boolean(input.photoUrl),
        hasSignature: Boolean(input.signatureUrl),
      },
    });

    const updated = await changeDeliveryStatus(tx, {
      companyId: delivery.companyId,
      deliveryId: delivery.id,
      to: "DELIVERED",
      proofMethod: req.targetProofMethod === "QR" ? "REVERSE_QR" : req.targetProofMethod,
      actor: { actorType: "COURIER", actorId: courier.id },
      context: {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
      proofPhotoUrl: input.photoUrl,
      proofSignatureUrl: input.signatureUrl,
      proofRecipientName: input.recipientName,
      amountCollected: input.amountCollected,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
    });

    return {
      ok: true as const,
      delivery: updated,
    };
  });
}
