import { and, desc, eq, ne } from "drizzle-orm";
import { companies, deliveries, deliveryAttempts, qrTokens, securityAlerts } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CourierIdentity } from "@/lib/auth/courier";
import { can, courierActor } from "@/lib/auth/permissions";
import { renderQrSvg } from "@/lib/qr/qr-matrix";
import { hashCode, hashToken, randomDigits, randomToken, verifyCode } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import { DeliveryError, normalizeGpsCoords, UUID_RE, type GpsCoordsInput } from "./errors";
import { changeDeliveryStatus } from "./status";
import { getProofModeRequirements, validateProofRequirements } from "@/lib/mvp1";

export const QR_TOKEN_TTL_MS = 3 * 60 * 1000; // 3 minutes (mvp.md §8.2)
export const MAX_HANDOVER_ATTEMPTS = 3;

export function buildClientConfirmUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/c/${token}`;
}

export type IssuedQrToken = {
  qrTokenId: string;
  deliveryId: string;
  attemptId: string;
  attemptNumber: number;
  token: string;
  confirmUrl: string;
  qrSvg: string;
  expiresAt: Date;
  ttlSeconds: number;
  revokedPreviousCount: number;
};

export type PublicDeliverySummary = {
  deliveryId: string;
  companyName: string;
  reference: string;
  recipientName: string;
  packageDescription: string | null;
  amountToCollect: number | null;
};

export type PublicQrStatus =
  | { found: false; state: "NOT_FOUND" }
  | {
      found: true;
      state: "DELIVERED" | "REVOKED" | "LOCKED" | "EXPIRED" | "INVALID_STATUS";
      delivery: PublicDeliverySummary;
    }
  | {
      found: true;
      state: "ACTIVE";
      delivery: PublicDeliverySummary;
      expiresAt: string;
      alreadyScanned: boolean;
    };

export type ScanQrResult =
  | {
      ok: true;
      state: "DELIVERED";
      delivery: PublicDeliverySummary;
    }
  | {
      ok: true;
      state: "CODE_ISSUED";
      handoverCode: string;
      expiresAt: Date;
      delivery: PublicDeliverySummary;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "REVOKED" | "LOCKED" | "EXPIRED" | "INVALID_STATUS" | "SAME_DEVICE";
      message: string;
      delivery?: PublicDeliverySummary;
    };

export type VerifyHandoverResult =
  | {
      ok: true;
      delivery: typeof deliveries.$inferSelect;
      billedPrice: number;
      suspiciousDeviceReuse: boolean;
    }
  | {
      ok: false;
      code:
        | "WRONG_CODE"
        | "QR_LOCKED"
        | "QR_EXPIRED"
        | "QR_REVOKED"
        | "QR_USED"
        | "NOT_SCANNED"
        | "SAME_DEVICE";
      remainingAttempts: number;
      message: string;
    };

/**
 * Génère côté serveur un jeton QR à usage unique (128 bits, stocké haché SHA-256,
 * valable 3 min) pour une livraison au statut `ARRIVED`, et révoque tout QR actif précédent.
 */
export async function issueDeliveryQrToken(
  db: Executor,
  courier: CourierIdentity,
  deliveryId: string,
  options: {
    appUrl?: string;
    deviceFingerprint?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  } = {},
): Promise<IssuedQrToken> {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérifié via can(courierActor(courier), "delivery.showQr", ...)
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.isTest, false)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const actor = courierActor(courier);
    const resource = {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    };

    if (!can(actor, "delivery.declareArrived", resource).allowed) {
      throw new DeliveryError(
        "FORBIDDEN",
        "Vous n'avez pas accès au QR de validation pour cette livraison.",
      );
    }

    if (!can(actor, "delivery.showQr", resource).allowed) {
      throw new DeliveryError(
        "INVALID",
        "Le QR de validation ne peut être généré qu'au statut Arrivé chez le destinataire.",
      );
    }

    let [attempt] =
      current.currentAttempt > 0
        ? await tx
            .select()
            .from(deliveryAttempts)
            .where(
              and(
                eq(deliveryAttempts.deliveryId, current.id),
                eq(deliveryAttempts.attemptNumber, current.currentAttempt),
              ),
            )
            .limit(1)
        : [];

    if (!attempt) {
      const attemptNum = Math.max(1, current.currentAttempt);
      const [insertedAttempt] = await tx
        .insert(deliveryAttempts)
        .values({
          deliveryId: current.id,
          courierId: courier.id,
          attemptNumber: attemptNum,
          outcome: "IN_PROGRESS",
          arrivedAt: new Date(),
        })
        .returning();
      attempt = insertedAttempt;
      if (current.currentAttempt !== attemptNum) {
        await tenantScope(tx, current.companyId).update(
          deliveries,
          { currentAttempt: attemptNum },
          eq(deliveries.id, current.id),
        );
      }
    }

    const [latestExisting] = await tx
      .select({ createdAt: qrTokens.createdAt })
      .from(qrTokens)
      .where(eq(qrTokens.deliveryId, current.id))
      .orderBy(desc(qrTokens.createdAt))
      .limit(1);

    const revoked = await tx
      .update(qrTokens)
      .set({ status: "REVOKED" })
      .where(and(eq(qrTokens.deliveryId, current.id), eq(qrTokens.status, "ACTIVE")))
      .returning({ id: qrTokens.id });

    const token = randomToken(16);
    const tokenHash = hashToken(token);
    const createdAt = new Date(
      Math.max(Date.now(), (latestExisting?.createdAt.getTime() ?? 0) + 1),
    );
    const expiresAt = new Date(createdAt.getTime() + QR_TOKEN_TTL_MS);

    const [created] = await tx
      .insert(qrTokens)
      .values({
        deliveryId: current.id,
        attemptId: attempt.id,
        courierId: courier.id,
        tokenHash,
        status: "ACTIVE",
        expiresAt,
        courierDeviceFingerprint: options.deviceFingerprint ?? courier.deviceFingerprint ?? null,
        createdAt,
      })
      .returning();

    await logEvent(tx, {
      companyId: current.companyId,
      deliveryId: current.id,
      eventType: "QR_GENERATED",
      actorType: "COURIER",
      actorId: courier.id,
      fromStatus: current.status,
      toStatus: current.status,
      payload: {
        qrTokenId: created.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        expiresAt: expiresAt.toISOString(),
        revokedPreviousCount: revoked.length,
      },
      ip: options.ip ?? null,
      userAgent: options.userAgent ?? null,
    });

    const confirmUrl = buildClientConfirmUrl(options.appUrl ?? "http://localhost:5000", token);
    const qrSvg = renderQrSvg(confirmUrl, { moduleSize: 6, margin: 4 });

    return {
      qrTokenId: created.id,
      deliveryId: current.id,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      token,
      confirmUrl,
      qrSvg,
      expiresAt,
      ttlSeconds: QR_TOKEN_TTL_MS / 1000,
      revokedPreviousCount: revoked.length,
    };
  });
}

/**
 * Lecture sans effet de bord de l'état d'un QR code client (`/c/<jeton>`),
 * utilisée notamment pour rafraîchir automatiquement l'écran destinataire.
 */
export async function getPublicQrStatus(db: Executor, rawToken: string): Promise<PublicQrStatus> {
  const token = rawToken.trim();
  if (!token || token.length > 200) {
    return { found: false, state: "NOT_FOUND" };
  }

  const [row] = await db
    .select({
      qrStatus: qrTokens.status,
      expiresAt: qrTokens.expiresAt,
      scannedAt: qrTokens.scannedAt,
      deliveryId: deliveries.id,
      deliveryStatus: deliveries.status,
      reference: deliveries.reference,
      recipientName: deliveries.recipientName,
      packageDescription: deliveries.packageDescription,
      amountToCollect: deliveries.amountToCollect,
      companyName: companies.name,
    })
    .from(qrTokens)
    // tenant-guard: page client publique /c/<jeton> — recherche par tokenHash 128 bits
    .innerJoin(deliveries, eq(qrTokens.deliveryId, deliveries.id))
    .innerJoin(companies, eq(deliveries.companyId, companies.id))
    .where(and(eq(qrTokens.tokenHash, hashToken(token)), eq(deliveries.isTest, false)))
    .limit(1);

  if (!row) {
    return { found: false, state: "NOT_FOUND" };
  }

  const delivery: PublicDeliverySummary = {
    deliveryId: row.deliveryId,
    companyName: row.companyName,
    reference: row.reference,
    recipientName: row.recipientName,
    packageDescription: row.packageDescription,
    amountToCollect: row.amountToCollect,
  };

  if (row.deliveryStatus === "DELIVERED" || row.qrStatus === "USED") {
    return { found: true, state: "DELIVERED", delivery };
  }
  if (row.qrStatus === "REVOKED") {
    return { found: true, state: "REVOKED", delivery };
  }
  if (row.qrStatus === "LOCKED") {
    return { found: true, state: "LOCKED", delivery };
  }
  if (row.qrStatus === "EXPIRED" || new Date() > row.expiresAt) {
    return { found: true, state: "EXPIRED", delivery };
  }
  if (row.deliveryStatus !== "ARRIVED") {
    return { found: true, state: "INVALID_STATUS", delivery };
  }

  return {
    found: true,
    state: "ACTIVE",
    delivery,
    expiresAt: row.expiresAt.toISOString(),
    alreadyScanned: row.scannedAt !== null,
  };
}

/**
 * Traite le scan du QR par le destinataire sur `/c/<jeton>` :
 * refuse le scan depuis l'appareil du livreur (`SAME_DEVICE_REJECTED`), sinon
 * génère le code à 4 chiffres (stocké haché) et consigne GPS, empreinte et IP.
 */
export async function scanDeliveryQrToken(
  db: Executor,
  rawToken: string,
  scanMeta: {
    deviceFingerprint?: string | null;
    courierIdFromCookie?: string | null;
    gps?: GpsCoordsInput | null;
    ip?: string | null;
    userAgent?: string | null;
  },
  masterKey: Buffer,
): Promise<ScanQrResult> {
  const token = rawToken.trim();
  if (!token || token.length > 200) {
    return { ok: false, code: "NOT_FOUND", message: "Ce lien de confirmation est introuvable." };
  }

  const tokenHash = hashToken(token);
  const coords = normalizeGpsCoords(scanMeta.gps);

  return db.transaction(async (tx) => {
    const [qr] = await tx
      .select()
      .from(qrTokens)
      .where(eq(qrTokens.tokenHash, tokenHash))
      .for("update")
      .limit(1);

    if (!qr) {
      return { ok: false, code: "NOT_FOUND", message: "Ce lien de confirmation est introuvable." };
    }

    const [row] = await tx
      .select({
        id: deliveries.id,
        companyId: deliveries.companyId,
        isTest: deliveries.isTest,
        status: deliveries.status,
        reference: deliveries.reference,
        recipientName: deliveries.recipientName,
        packageDescription: deliveries.packageDescription,
        amountToCollect: deliveries.amountToCollect,
        companyName: companies.name,
      })
      // tenant-guard: scan client /c/<jeton> — livraison identifiée par tokenHash 128 bits
      .from(deliveries)
      .innerJoin(companies, eq(deliveries.companyId, companies.id))
      .where(and(eq(deliveries.id, qr.deliveryId), eq(deliveries.isTest, false)))
      .limit(1);

    if (!row) {
      return { ok: false, code: "NOT_FOUND", message: "Ce lien de confirmation est introuvable." };
    }

    const delivery: PublicDeliverySummary = {
      deliveryId: row.id,
      companyName: row.companyName,
      reference: row.reference,
      recipientName: row.recipientName,
      packageDescription: row.packageDescription,
      amountToCollect: row.amountToCollect,
    };

    if (row.status === "DELIVERED" || qr.status === "USED") {
      return { ok: true, state: "DELIVERED", delivery };
    }
    if (qr.status === "REVOKED") {
      return {
        ok: false,
        code: "REVOKED",
        message: "Ce QR code a été remplacé par un nouveau QR.",
        delivery,
      };
    }
    if (qr.status === "LOCKED") {
      return {
        ok: false,
        code: "LOCKED",
        message: "Ce QR code est bloqué après 3 codes erronés.",
        delivery,
      };
    }

    const now = new Date();
    if (qr.status === "EXPIRED" || now > qr.expiresAt) {
      if (qr.status === "ACTIVE") {
        await tx.update(qrTokens).set({ status: "EXPIRED" }).where(eq(qrTokens.id, qr.id));
      }
      return {
        ok: false,
        code: "EXPIRED",
        message: "Ce QR code a expiré (validité 3 minutes). Demandez un nouveau QR au livreur.",
        delivery,
      };
    }

    if (row.status !== "ARRIVED") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        message: "Cette livraison n'est plus en attente de confirmation.",
        delivery,
      };
    }

    const sameCourierSession = Boolean(
      scanMeta.courierIdFromCookie && scanMeta.courierIdFromCookie === qr.courierId,
    );
    const sameDeviceFingerprint = Boolean(
      scanMeta.deviceFingerprint &&
        qr.courierDeviceFingerprint &&
        scanMeta.deviceFingerprint === qr.courierDeviceFingerprint,
    );

    if (sameCourierSession || sameDeviceFingerprint) {
      await logEvent(tx, {
        companyId: row.companyId,
        deliveryId: row.id,
        eventType: "SAME_DEVICE_REJECTED",
        actorType: "RECIPIENT",
        actorId: null,
        fromStatus: row.status,
        toStatus: row.status,
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        ip: scanMeta.ip ?? null,
        userAgent: scanMeta.userAgent ?? null,
        payload: {
          qrTokenId: qr.id,
          courierId: qr.courierId,
          clientDeviceFingerprint: scanMeta.deviceFingerprint ?? null,
          reason: sameCourierSession ? "COURIER_SESSION" : "DEVICE_FINGERPRINT",
        },
      });
      return {
        ok: false,
        code: "SAME_DEVICE",
        message:
          "Ce QR code doit être scanné avec le téléphone du destinataire, pas celui du livreur.",
        delivery,
      };
    }

    const handoverCode = randomDigits(4);
    const handoverCodeHash = hashCode(handoverCode, qr.id, masterKey);

    await tx
      .update(qrTokens)
      .set({
        handoverCodeHash,
        scannedAt: now,
        clientDeviceFingerprint: scanMeta.deviceFingerprint ?? null,
        clientIp: scanMeta.ip ?? null,
        clientUserAgent: scanMeta.userAgent ?? null,
        clientLat: coords.lat,
        clientLng: coords.lng,
        clientAccuracy: coords.accuracy,
      })
      .where(eq(qrTokens.id, qr.id));

    await logEvent(tx, {
      companyId: row.companyId,
      deliveryId: row.id,
      eventType: "QR_SCANNED",
      actorType: "RECIPIENT",
      actorId: null,
      fromStatus: row.status,
      toStatus: row.status,
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      ip: scanMeta.ip ?? null,
      userAgent: scanMeta.userAgent ?? null,
      payload: {
        qrTokenId: qr.id,
        gpsMissing: coords.gpsMissing,
        clientDeviceFingerprint: scanMeta.deviceFingerprint ?? null,
      },
    });

    return {
      ok: true,
      state: "CODE_ISSUED",
      handoverCode,
      expiresAt: qr.expiresAt,
      delivery,
    };
  });
}

/**
 * Vérifie le code de remise à 4 chiffres saisi par le livreur, clôture la livraison
 * à `DELIVERED` (avec `proofMethod = "QR"` et `billedPrice` figé) ou gère
 * le blocage après 3 essais faux (`QR_LOCKED`) et la détection d'appareil suspect (`SUSPICIOUS_DEVICE_REUSE`).
 */
export async function verifyDeliveryHandoverCode(
  db: Executor,
  courier: CourierIdentity,
  input: {
    deliveryId: string;
    code: string;
    gps?: GpsCoordsInput | null;
    ip?: string | null;
    userAgent?: string | null;
    photoUrl?: string | null;
    signatureUrl?: string | null;
    recipientName?: string | null;
    amountCollected?: number | null;
    paymentMethod?: "CASH" | "WAVE" | "ORANGE_MONEY" | "MTN_MOMO" | "MOOV_MONEY" | "OTHER" | null;
    paymentReference?: string | null;
  },
  masterKey: Buffer,
): Promise<VerifyHandoverResult> {
  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const cleanCode = input.code.trim();
  if (!/^\d{4}$/.test(cleanCode)) {
    throw new DeliveryError("INVALID", "Le code de remise doit comporter 4 chiffres.");
  }

  const coords = normalizeGpsCoords(input.gps);

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérifié via can(courierActor(courier), "delivery.enterHandoverCode", ...)
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
      throw new DeliveryError("INVALID", "La livraison n'est plus en attente de code.");
    }

    const [qr] = await tx
      .select()
      .from(qrTokens)
      .where(eq(qrTokens.deliveryId, delivery.id))
      .orderBy(desc(qrTokens.createdAt))
      .for("update")
      .limit(1);

    if (!qr) {
      return {
        ok: false,
        code: "NOT_SCANNED",
        remainingAttempts: MAX_HANDOVER_ATTEMPTS,
        message: "Générez d'abord un QR code à faire scanner par le client.",
      };
    }

    if (qr.status === "LOCKED") {
      return {
        ok: false,
        code: "QR_LOCKED",
        remainingAttempts: 0,
        message: "Ce QR est verrouillé après 3 essais faux. Générez un nouveau QR.",
      };
    }

    if (qr.status === "REVOKED") {
      return {
        ok: false,
        code: "QR_REVOKED",
        remainingAttempts: 0,
        message: "Ce QR a été remplacé. Faites scanner le QR le plus récent.",
      };
    }

    if (qr.status === "USED") {
      return {
        ok: false,
        code: "QR_USED",
        remainingAttempts: 0,
        message: "Ce QR a déjà été utilisé.",
      };
    }

    const now = new Date();
    if (qr.status === "EXPIRED" || now > qr.expiresAt) {
      if (qr.status === "ACTIVE") {
        await tx.update(qrTokens).set({ status: "EXPIRED" }).where(eq(qrTokens.id, qr.id));
      }
      return {
        ok: false,
        code: "QR_EXPIRED",
        remainingAttempts: 0,
        message: "Ce QR a expiré (plus de 3 minutes). Générez un nouveau QR.",
      };
    }

    if (!qr.handoverCodeHash || !qr.scannedAt) {
      return {
        ok: false,
        code: "NOT_SCANNED",
        remainingAttempts: MAX_HANDOVER_ATTEMPTS - qr.failedCodeAttempts,
        message: "Le destinataire doit d'abord scanner le QR code sur son téléphone.",
      };
    }

    if (
      qr.clientDeviceFingerprint &&
      qr.courierDeviceFingerprint &&
      qr.clientDeviceFingerprint === qr.courierDeviceFingerprint
    ) {
      return {
        ok: false,
        code: "SAME_DEVICE",
        remainingAttempts: 0,
        message: "Validation refusée : le scan provient de l'appareil du livreur.",
      };
    }

    const matches = verifyCode(cleanCode, qr.id, qr.handoverCodeHash, masterKey);
    if (!matches) {
      const nextFailed = qr.failedCodeAttempts + 1;
      const locked = nextFailed >= MAX_HANDOVER_ATTEMPTS;
      const remaining = Math.max(0, MAX_HANDOVER_ATTEMPTS - nextFailed);

      await tx
        .update(qrTokens)
        .set({
          failedCodeAttempts: nextFailed,
          status: locked ? "LOCKED" : "ACTIVE",
        })
        .where(eq(qrTokens.id, qr.id));

      await logEvent(tx, {
        companyId: delivery.companyId,
        deliveryId: delivery.id,
        eventType: locked ? "QR_LOCKED" : "QR_CODE_REJECTED",
        actorType: "COURIER",
        actorId: courier.id,
        fromStatus: delivery.status,
        toStatus: delivery.status,
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        payload: {
          qrTokenId: qr.id,
          failedCodeAttempts: nextFailed,
          remainingAttempts: remaining,
        },
      });

      if (locked) {
        return {
          ok: false,
          code: "QR_LOCKED",
          remainingAttempts: 0,
          message: "3 codes erronés : ce QR est verrouillé. Générez un nouveau QR.",
        };
      }

      return {
        ok: false,
        code: "WRONG_CODE",
        remainingAttempts: remaining,
        message: `Code incorrect (${remaining} essai${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}).`,
      };
    }

    await tx
      .update(qrTokens)
      .set({
        status: "USED",
        usedAt: now,
        courierLatAtValidation: coords.lat,
        courierLngAtValidation: coords.lng,
      })
      .where(eq(qrTokens.id, qr.id));

    // Vérifier les exigences de preuve MVP 1 (photo, signature)
    const proofValidation = validateProofRequirements(delivery.proofMode, {
      photoUrl: input.photoUrl,
      signatureUrl: input.signatureUrl,
    });
    if (!proofValidation.valid) {
      throw new DeliveryError("INVALID", proofValidation.error ?? "Preuve incomplète.");
    }

    const req = getProofModeRequirements(delivery.proofMode);

    const updated = await changeDeliveryStatus(tx, {
      companyId: delivery.companyId,
      deliveryId: delivery.id,
      to: "DELIVERED",
      proofMethod: req.targetProofMethod,
      actor: { actorType: "COURIER", actorId: courier.id },
      context: {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        payload: {
          qrTokenId: qr.id,
          attemptNumber: delivery.currentAttempt,
          gpsMissing: coords.gpsMissing,
          hasPhoto: Boolean(input.photoUrl),
          hasSignature: Boolean(input.signatureUrl),
        },
      },
      proofPhotoUrl: input.photoUrl,
      proofSignatureUrl: input.signatureUrl,
      proofRecipientName: input.recipientName,
      amountCollected: input.amountCollected,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
    });

    let suspiciousDeviceReuse = false;
    if (qr.clientDeviceFingerprint) {
      const priorUsages = await tx
        .select({ deliveryId: qrTokens.deliveryId })
        .from(qrTokens)
        .where(
          and(
            eq(qrTokens.courierId, courier.id),
            eq(qrTokens.clientDeviceFingerprint, qr.clientDeviceFingerprint),
            eq(qrTokens.status, "USED"),
            ne(qrTokens.deliveryId, delivery.id),
          ),
        )
        .limit(5);

      if (priorUsages.length > 0) {
        suspiciousDeviceReuse = true;
        const deliveryIds = [...new Set([...priorUsages.map((u) => u.deliveryId), delivery.id])];
        await tenantScope(tx, delivery.companyId).insert(securityAlerts, {
          courierId: courier.id,
          deliveryId: delivery.id,
          type: "SUSPICIOUS_DEVICE_REUSE",
          details: {
            clientDeviceFingerprint: qr.clientDeviceFingerprint,
            deliveryIds,
          },
        });
        await logEvent(tx, {
          companyId: delivery.companyId,
          deliveryId: delivery.id,
          eventType: "SUSPICIOUS_DEVICE_REUSE",
          actorType: "SYSTEM",
          actorId: null,
          fromStatus: updated.status,
          toStatus: updated.status,
          payload: {
            courierId: courier.id,
            clientDeviceFingerprint: qr.clientDeviceFingerprint,
            deliveryIds,
          },
        });
      }
    }

    return {
      ok: true,
      delivery: updated,
      billedPrice: updated.billedPrice ?? 0,
      suspiciousDeviceReuse,
    };
  });
}
