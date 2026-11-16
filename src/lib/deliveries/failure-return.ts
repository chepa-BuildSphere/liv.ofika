import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  companyCouriers,
  couriers,
  deliveries,
  deliveryAttempts,
  manualOverrides,
  qrTokens,
  returnReceptions,
  users,
} from "@/db/schema";
import type { Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import type { CourierIdentity } from "@/lib/auth/courier";
import { can, courierActor, userActor } from "@/lib/auth/permissions";
import { tenantScope } from "@/lib/tenant/scope";
import {
  DeliveryError,
  normalizeGpsCoords,
  UUID_RE,
  type DeliveryField,
  type GpsCoordsInput,
} from "./errors";
import {
  matchReturningDeliveryByScan,
  type CourierReturningGroup,
  type ReceivedReturnItem,
  type ReturningDeliveryItem,
} from "./return-scan";
import { changeDeliveryStatus, TransitionRefused } from "./status";
import {
  AFTER_FAILURE_CHOICES,
  FAILURE_REASON_LABEL,
  FAILURE_REASONS,
  FORCE_DELIVERED_FROM,
  RETURN_CONDITIONS,
  type AfterFailureChoice,
  type FailureReason,
  type ReturnCondition,
} from "./transitions";

export {
  matchReturningDeliveryByScan,
  type CourierReturningGroup,
  type ReceivedReturnItem,
  type ReturningDeliveryItem,
};

const MAX_COMMENT_LEN = 1000;
const MAX_HTTP_PHOTO_LEN = 2048;
const MAX_DATA_PHOTO_LEN = 700_000;
const DATA_IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

export type DeclareFailureInput = {
  failureReason: string;
  comment?: string | null;
  photoUrl?: string | null;
  afterFailure?: string | null;
};

export type ValidatedFailureInput = {
  failureReason: FailureReason;
  comment: string | null;
  photoUrl: string | null;
  afterFailure: AfterFailureChoice | null;
};

export type FailureValidationResult =
  | { ok: true; data: ValidatedFailureInput }
  | { ok: false; fields: Partial<Record<DeliveryField, string>> };

function cleanPhotoUrl(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.startsWith("data:")) {
    if (!DATA_IMAGE_RE.test(trimmed)) {
      return {
        ok: false,
        error: "Format d'image invalide (JPEG, PNG ou WebP uniquement).",
      };
    }
    if (trimmed.length > MAX_DATA_PHOTO_LEN) {
      return {
        ok: false,
        error: "La photo est trop volumineuse (500 Ko maximum).",
      };
    }
    return { ok: true, value: trimmed };
  }
  if (trimmed.length > MAX_HTTP_PHOTO_LEN) {
    return { ok: false, error: "L'URL de la photo est trop longue." };
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return { ok: true, value: u.toString() };
    }
  } catch {
    // tombe sur le message d'erreur ci-dessous
  }
  return { ok: false, error: "URL ou image photo invalide." };
}

/** Valide le motif d'échec, l'obligation de commentaire si `OTHER`, la photo et la suite éventuelle. */
export function validateFailureDeclarationInput(
  raw: DeclareFailureInput,
): FailureValidationResult {
  const fields: Partial<Record<DeliveryField, string>> = {};

  const reason = raw.failureReason?.trim();
  const validReason = FAILURE_REASONS.includes(reason as FailureReason)
    ? (reason as FailureReason)
    : null;
  if (!validReason) {
    fields.failureReason = "Choisissez un motif d'échec valide.";
  }

  const trimmedComment = raw.comment?.trim() ?? "";
  let cleanComment: string | null = null;
  if (trimmedComment) {
    if (trimmedComment.length > MAX_COMMENT_LEN) {
      fields.comment = `Le commentaire ne doit pas dépasser ${MAX_COMMENT_LEN} caractères.`;
    } else {
      cleanComment = trimmedComment;
    }
  }
  if (validReason === "OTHER" && !cleanComment) {
    fields.comment = "Le commentaire est obligatoire lorsque vous choisissez « Autre motif ».";
  }

  const photo = cleanPhotoUrl(raw.photoUrl);
  if (!photo.ok) {
    fields.photoUrl = photo.error;
  }

  const rawAfter = raw.afterFailure?.trim() ?? "";
  let afterChoice: AfterFailureChoice | null = null;
  if (rawAfter) {
    if (AFTER_FAILURE_CHOICES.includes(rawAfter as AfterFailureChoice)) {
      afterChoice = rawAfter as AfterFailureChoice;
    } else {
      fields.afterFailure = "Choix après échec invalide.";
    }
  }

  if (Object.keys(fields).length > 0 || !validReason || !photo.ok) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    data: {
      failureReason: validReason,
      comment: cleanComment,
      photoUrl: photo.value,
      afterFailure: afterChoice,
    },
  };
}

async function applyAfterFailureChoice(
  tx: Executor,
  courier: CourierIdentity,
  current: typeof deliveries.$inferSelect,
  afterFailure: AfterFailureChoice,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<typeof deliveries.$inferSelect> {
  if (current.currentAttempt > 0) {
    await tx
      .update(deliveryAttempts)
      .set({ afterFailure })
      .where(
        and(
          eq(deliveryAttempts.deliveryId, current.id),
          eq(deliveryAttempts.attemptNumber, current.currentAttempt),
        ),
      );
  }

  const targetStatus = afterFailure === "RETRY" ? "PICKED_UP" : "RETURNING";
  return changeDeliveryStatus(tx, {
    companyId: current.companyId,
    deliveryId: current.id,
    to: targetStatus,
    actor: { actorType: "COURIER", actorId: courier.id },
    context: {
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      payload: {
        attemptNumber: current.currentAttempt,
        afterFailure,
      },
    },
  });
}

/**
 * Déclare un échec de livraison (`ARRIVED → DELIVERY_FAILED`) avec motif, commentaire
 * (obligatoire si `OTHER`), photo facultative, GPS, et suite optionnelle immédiate (`RETRY` / `RETURN_TO_DEPOT`).
 */
export async function declareCourierFailure(
  db: Executor,
  courier: CourierIdentity,
  input: DeclareFailureInput & {
    deliveryId: string;
    gps?: GpsCoordsInput | null;
  },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{
  delivery: typeof deliveries.$inferSelect;
  attempt: typeof deliveryAttempts.$inferSelect;
  gpsMissing: boolean;
}> {
  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const checked = validateFailureDeclarationInput(input);
  if (!checked.ok) {
    const firstMsg = Object.values(checked.fields)[0] ?? "Déclaration d'échec invalide.";
    throw new DeliveryError("INVALID", firstMsg, checked.fields);
  }
  const valid = checked.data;
  const coords = normalizeGpsCoords(input.gps);

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérifié via can(courierActor(courier), "delivery.declareFailureOrRetry", ...)
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, input.deliveryId), eq(deliveries.isTest, false)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(courierActor(courier), "delivery.declareFailureOrRetry", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      throw new DeliveryError("FORBIDDEN", "Vous ne pouvez déclarer un échec que sur vos propres colis.");
    }

    if (current.status !== "ARRIVED") {
      throw new DeliveryError(
        "INVALID",
        "L'échec ne peut être déclaré qu'au statut Arrivé chez le destinataire.",
      );
    }

    await tx
      .update(qrTokens)
      .set({ status: "REVOKED" })
      .where(and(eq(qrTokens.deliveryId, current.id), eq(qrTokens.status, "ACTIVE")));

    const reasonLabel = FAILURE_REASON_LABEL[valid.failureReason];
    const reasonSummary = valid.comment ? `${reasonLabel} — ${valid.comment}` : reasonLabel;

    let failedDelivery: typeof deliveries.$inferSelect;
    try {
      failedDelivery = await changeDeliveryStatus(tx, {
        companyId: current.companyId,
        deliveryId: current.id,
        to: "DELIVERY_FAILED",
        reason: reasonSummary,
        actor: { actorType: "COURIER", actorId: courier.id },
        context: {
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          payload: {
            attemptNumber: current.currentAttempt,
            failureReason: valid.failureReason,
            failureComment: valid.comment,
            hasPhoto: Boolean(valid.photoUrl),
            gpsMissing: coords.gpsMissing,
          },
        },
      });
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError(
          "INVALID",
          "L'échec ne peut être déclaré qu'au statut Arrivé chez le destinataire.",
        );
      }
      throw e;
    }

    let attemptNum = failedDelivery.currentAttempt;
    if (attemptNum === 0) {
      attemptNum = 1;
      const [insertedAttempt] = await tx
        .insert(deliveryAttempts)
        .values({
          deliveryId: failedDelivery.id,
          courierId: courier.id,
          attemptNumber: 1,
          outcome: "FAILED",
          failureReason: valid.failureReason,
          failureComment: valid.comment,
          failurePhotoUrl: valid.photoUrl,
          failedAt: failedDelivery.updatedAt,
          failedLat: coords.lat,
          failedLng: coords.lng,
        })
        .returning();
      await tenantScope(tx, failedDelivery.companyId).update(
        deliveries,
        { currentAttempt: 1 },
        eq(deliveries.id, failedDelivery.id),
      );
      failedDelivery = { ...failedDelivery, currentAttempt: 1 };
      void insertedAttempt;
    } else {
      await tx
        .update(deliveryAttempts)
        .set({
          outcome: "FAILED",
          failureReason: valid.failureReason,
          failureComment: valid.comment,
          failurePhotoUrl: valid.photoUrl,
          failedAt: failedDelivery.updatedAt,
          failedLat: coords.lat,
          failedLng: coords.lng,
        })
        .where(
          and(
            eq(deliveryAttempts.deliveryId, failedDelivery.id),
            eq(deliveryAttempts.attemptNumber, attemptNum),
          ),
        );
    }

    let finalDelivery = failedDelivery;
    if (valid.afterFailure) {
      finalDelivery = await applyAfterFailureChoice(
        tx,
        courier,
        failedDelivery,
        valid.afterFailure,
        meta,
      );
    }

    const [attempt] = await tx
      .select()
      .from(deliveryAttempts)
      .where(
        and(
          eq(deliveryAttempts.deliveryId, finalDelivery.id),
          eq(deliveryAttempts.attemptNumber, attemptNum),
        ),
      )
      .limit(1);

    return {
      delivery: finalDelivery,
      attempt,
      gpsMissing: coords.gpsMissing,
    };
  });
}

/**
 * Enregistre la suite choisie par le livreur après un échec (`DELIVERY_FAILED`) :
 * « Nouvelle tentative » (`PICKED_UP`, tentatives illimitées) ou « Retour au dépôt » (`RETURNING`).
 */
export async function chooseCourierAfterFailure(
  db: Executor,
  courier: CourierIdentity,
  deliveryId: string,
  afterFailure: AfterFailureChoice,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{
  delivery: typeof deliveries.$inferSelect;
  afterFailure: AfterFailureChoice;
}> {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }
  if (!AFTER_FAILURE_CHOICES.includes(afterFailure)) {
    throw new DeliveryError("INVALID", "Choix après échec invalide.", {
      afterFailure: "Choisissez Nouvelle tentative ou Retour au dépôt.",
    });
  }

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérifié via can(courierActor(courier), "delivery.declareFailureOrRetry", ...)
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.isTest, false)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(courierActor(courier), "delivery.declareFailureOrRetry", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      throw new DeliveryError("FORBIDDEN", "Vous ne pouvez agir que sur vos propres colis.");
    }

    if (current.status !== "DELIVERY_FAILED") {
      throw new DeliveryError(
        "INVALID",
        "Le choix après échec n'est possible que pour un colis au statut Échec.",
      );
    }

    try {
      const updated = await applyAfterFailureChoice(tx, courier, current, afterFailure, meta);
      return { delivery: updated, afterFailure };
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError(
          "INVALID",
          "Le choix après échec n'est possible que pour un colis au statut Échec.",
        );
      }
      throw e;
    }
  });
}

// ─── Tâches 5.3 & 5.4 : Réception des retours au dépôt ───────────────────────

export type ReturnReceptionInput = {
  condition: string;
  comment?: string | null;
  photoUrl?: string | null;
};

export type ValidatedReturnReceptionInput = {
  condition: ReturnCondition;
  comment: string | null;
  photoUrl: string | null;
};

export type ReturnReceptionValidationResult =
  | { ok: true; data: ValidatedReturnReceptionInput }
  | { ok: false; fields: Partial<Record<DeliveryField, string>> };

/** Valide l'état physique, le commentaire et la photo lors de la réception d'un retour. */
export function validateReturnReceptionInput(
  raw: ReturnReceptionInput,
): ReturnReceptionValidationResult {
  const fields: Partial<Record<DeliveryField, string>> = {};

  const cond = raw.condition?.trim();
  const validCondition = RETURN_CONDITIONS.includes(cond as ReturnCondition)
    ? (cond as ReturnCondition)
    : null;
  if (!validCondition) {
    fields.condition = "Choisissez l'état du colis (Bon état ou Endommagé).";
  }

  const trimmedComment = raw.comment?.trim() ?? "";
  let cleanComment: string | null = null;
  if (trimmedComment) {
    if (trimmedComment.length > MAX_COMMENT_LEN) {
      fields.comment = `Le commentaire ne doit pas dépasser ${MAX_COMMENT_LEN} caractères.`;
    } else {
      cleanComment = trimmedComment;
    }
  }

  const photo = cleanPhotoUrl(raw.photoUrl);
  if (!photo.ok) {
    fields.photoUrl = photo.error;
  }

  if (Object.keys(fields).length > 0 || !validCondition || !photo.ok) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    data: {
      condition: validCondition,
      comment: cleanComment,
      photoUrl: photo.value,
    },
  };
}

/**
 * Liste les colis en attente de réception (`RETURNING`) regroupés par livreur,
 * ainsi que les 20 derniers retours réceptionnés (`RETURN_RECEIVED`).
 */
export async function listReturningDeliveriesGroupedByCourier(
  db: Executor,
  actor: CompanyUserIdentity,
): Promise<{ groups: CourierReturningGroup[]; recentReceived: ReceivedReturnItem[] }> {
  const actorRef = userActor(actor);
  if (
    !can(actorRef, "return.receive", {
      companyId: actor.companyId,
      status: "RETURNING",
      courierId: null,
    }).allowed
  ) {
    throw new DeliveryError("FORBIDDEN", "Vous n'avez pas accès à la réception des retours.");
  }

  const returningRows = await db
    .select({
      delivery: deliveries,
      courierName: couriers.name,
      courierPhone: couriers.phone,
    })
    .from(deliveries)
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .where(
      tenantScope(db, actor.companyId).filter(
        deliveries,
        eq(deliveries.status, "RETURNING"),
        eq(deliveries.isTest, false),
      ),
    )
    .orderBy(asc(couriers.name), desc(deliveries.updatedAt));

  const returningIds = returningRows.map((r) => r.delivery.id);
  const latestAttemptByDelivery = new Map<string, typeof deliveryAttempts.$inferSelect>();
  if (returningIds.length > 0) {
    const attemptRows = await db
      .select()
      .from(deliveryAttempts)
      .where(inArray(deliveryAttempts.deliveryId, returningIds))
      .orderBy(desc(deliveryAttempts.attemptNumber));
    for (const att of attemptRows) {
      if (!latestAttemptByDelivery.has(att.deliveryId)) {
        latestAttemptByDelivery.set(att.deliveryId, att);
      }
    }
  }

  const groupMap = new Map<string, CourierReturningGroup>();
  for (const row of returningRows) {
    const d = row.delivery;
    const attempt = latestAttemptByDelivery.get(d.id) ?? null;
    const returnDeclaredByCourierId = attempt?.courierId ?? d.courierId;
    const decision = can(actorRef, "return.receive", {
      companyId: d.companyId,
      status: d.status,
      courierId: d.courierId,
      returnDeclaredByCourierId,
    });

    const courierName = row.courierName ?? "Livreur non identifié";
    const groupKey = d.courierId ?? "__unassigned__";
    let group = groupMap.get(groupKey);
    if (!group) {
      group = {
        courierId: d.courierId,
        courierName,
        courierPhone: row.courierPhone ?? null,
        items: [],
      };
      groupMap.set(groupKey, group);
    }

    group.items.push({
      id: d.id,
      reference: d.reference,
      recipientName: d.recipientName,
      address: d.address,
      district: d.district,
      packageDescription: d.packageDescription,
      amountToCollect: d.amountToCollect,
      courierId: d.courierId,
      courierName,
      returnDeclaredByCourierId,
      failureReason: attempt?.failureReason ?? null,
      failureComment: attempt?.failureComment ?? null,
      failurePhotoUrl: attempt?.failurePhotoUrl ?? null,
      failedAt: attempt?.failedAt ?? null,
      returningSince: d.updatedAt,
      canReceive: decision.allowed,
      cannotReceiveReason: decision.allowed ? null : decision.reason,
    });
  }

  // tenant-guard: filtré par tenantScope(actor.companyId) sur deliveries et users
  const recentRows = await db
    .select({
      deliveryId: deliveries.id,
      reference: deliveries.reference,
      recipientName: deliveries.recipientName,
      courierName: couriers.name,
      condition: returnReceptions.condition,
      comment: returnReceptions.comment,
      photoUrl: returnReceptions.photoUrl,
      receivedAt: returnReceptions.receivedAt,
      receivedByName: users.name,
    })
    .from(returnReceptions)
    .innerJoin(deliveries, eq(returnReceptions.deliveryId, deliveries.id))
    .innerJoin(users, eq(returnReceptions.receivedByUserId, users.id))
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .where(
      tenantScope(db, actor.companyId).filter(
        deliveries,
        eq(deliveries.status, "RETURN_RECEIVED"),
        eq(deliveries.isTest, false),
      ),
    )
    .orderBy(desc(returnReceptions.receivedAt))
    .limit(20);

  return {
    groups: [...groupMap.values()],
    recentReceived: recentRows,
  };
}

/** Confirme la réception physique d'un colis en retour (`RETURNING → RETURN_RECEIVED`). */
export async function receiveDeliveryReturn(
  db: Executor,
  actor: CompanyUserIdentity,
  input: ReturnReceptionInput & { deliveryId: string },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{
  delivery: typeof deliveries.$inferSelect;
  reception: typeof returnReceptions.$inferSelect;
}> {
  const actorRef = userActor(actor);
  if (
    !can(actorRef, "return.receive", {
      companyId: actor.companyId,
      status: "RETURNING",
      courierId: null,
    }).allowed
  ) {
    throw new DeliveryError("FORBIDDEN", "Vous n'avez pas le droit de réceptionner les retours.");
  }

  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const checked = validateReturnReceptionInput(input);
  if (!checked.ok) {
    const firstMsg = Object.values(checked.fields)[0] ?? "Informations de retour invalides.";
    throw new DeliveryError("INVALID", firstMsg, checked.fields);
  }
  const valid = checked.data;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(tenantScope(tx, actor.companyId).filter(deliveries, eq(deliveries.id, input.deliveryId), eq(deliveries.isTest, false)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const [latestAttempt] = await tx
      .select({ courierId: deliveryAttempts.courierId })
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, current.id))
      .orderBy(desc(deliveryAttempts.attemptNumber))
      .limit(1);

    const returnDeclaredByCourierId = latestAttempt?.courierId ?? current.courierId;
    const decision = can(actorRef, "return.receive", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
      returnDeclaredByCourierId,
    });
    if (!decision.allowed) {
      throw new DeliveryError("FORBIDDEN", decision.reason);
    }

    if (current.status !== "RETURNING") {
      throw new DeliveryError(
        "INVALID",
        "Seuls les colis en retour au dépôt peuvent être réceptionnés.",
      );
    }

    let updated: typeof deliveries.$inferSelect;
    try {
      updated = await changeDeliveryStatus(tx, {
        companyId: actor.companyId,
        deliveryId: current.id,
        to: "RETURN_RECEIVED",
        actor: { actorType: "USER", actorId: actor.id },
        context: {
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          payload: {
            condition: valid.condition,
            comment: valid.comment,
            hasPhoto: Boolean(valid.photoUrl),
            courierId: current.courierId,
          },
        },
      });
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError(
          "INVALID",
          "Seuls les colis en retour au dépôt peuvent être réceptionnés.",
        );
      }
      throw e;
    }

    const [reception] = await tx
      .insert(returnReceptions)
      .values({
        deliveryId: current.id,
        receivedByUserId: actor.id,
        condition: valid.condition,
        comment: valid.comment,
        photoUrl: valid.photoUrl,
        receivedAt: updated.updatedAt,
      })
      .returning();

    return { delivery: updated, reception };
  });
}

// ─── Tâche 5.5 : Forcer Livré (admin entreprise) ─────────────────────────────

const MIN_FORCE_REASON_LEN = 3;

export type ForceDeliveredInput = {
  reason: string;
  attachmentUrl?: string | null;
};

export type ValidatedForceDeliveredInput = {
  reason: string;
  attachmentUrl: string | null;
};

export type ForceDeliveredValidationResult =
  | { ok: true; data: ValidatedForceDeliveredInput }
  | { ok: false; fields: Partial<Record<DeliveryField, string>> };

/** Valide le motif obligatoire et la pièce jointe facultative pour « Forcer Livré ». */
export function validateForceDeliveredInput(
  raw: ForceDeliveredInput,
): ForceDeliveredValidationResult {
  const fields: Partial<Record<DeliveryField, string>> = {};

  const reason = raw.reason?.trim() ?? "";
  if (reason.length < MIN_FORCE_REASON_LEN) {
    fields.reason = `Le motif est obligatoire (${MIN_FORCE_REASON_LEN} caractères minimum).`;
  } else if (reason.length > MAX_COMMENT_LEN) {
    fields.reason = `Le motif ne doit pas dépasser ${MAX_COMMENT_LEN} caractères.`;
  }

  const attachment = cleanPhotoUrl(raw.attachmentUrl);
  if (!attachment.ok) {
    fields.attachmentUrl = attachment.error;
  }

  if (Object.keys(fields).length > 0 || !attachment.ok) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    data: {
      reason,
      attachmentUrl: attachment.value,
    },
  };
}

/**
 * Force une livraison à `DELIVERED` (`proof_method = MANUAL`) avec motif obligatoire
 * et pièce jointe facultative. Refusé aux non-admins et sur un colis livré par l'acteur lui-même.
 */
export async function forceDeliverDelivery(
  db: Executor,
  actor: CompanyUserIdentity,
  input: ForceDeliveredInput & { deliveryId: string },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{
  delivery: typeof deliveries.$inferSelect;
  override: typeof manualOverrides.$inferSelect;
}> {
  const actorRef = userActor(actor);
  if (
    !can(actorRef, "delivery.forceDelivered", {
      companyId: actor.companyId,
      status: "ARRIVED",
      courierId: null,
    }).allowed
  ) {
    throw new DeliveryError("FORBIDDEN", "Seul l'admin entreprise peut forcer une livraison.");
  }

  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const checked = validateForceDeliveredInput(input);
  if (!checked.ok) {
    const firstMsg = Object.values(checked.fields)[0] ?? "Motif obligatoire pour Forcer Livré.";
    throw new DeliveryError("INVALID", firstMsg, checked.fields);
  }
  const valid = checked.data;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(tenantScope(tx, actor.companyId).filter(deliveries, eq(deliveries.id, input.deliveryId), eq(deliveries.isTest, false)))
      .for("update")
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(actorRef, "delivery.forceDelivered", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      throw new DeliveryError("FORBIDDEN", decision.reason);
    }

    if (!FORCE_DELIVERED_FROM.includes(current.status)) {
      throw new DeliveryError(
        "INVALID",
        "« Forcer Livré » n'est possible qu'après prise en charge et avant clôture du colis.",
      );
    }

    await tx
      .update(qrTokens)
      .set({ status: "REVOKED" })
      .where(and(eq(qrTokens.deliveryId, current.id), eq(qrTokens.status, "ACTIVE")));

    let updated: typeof deliveries.$inferSelect;
    try {
      updated = await changeDeliveryStatus(tx, {
        companyId: actor.companyId,
        deliveryId: current.id,
        to: "DELIVERED",
        proofMethod: "MANUAL",
        reason: valid.reason,
        actor: { actorType: "USER", actorId: actor.id },
        context: {
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
          payload: {
            reason: valid.reason,
            hasAttachment: Boolean(valid.attachmentUrl),
            previousStatus: current.status,
          },
        },
      });
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError(
          "INVALID",
          "« Forcer Livré » n'est possible qu'après prise en charge et avant clôture du colis.",
        );
      }
      throw e;
    }

    const [override] = await tx
      .insert(manualOverrides)
      .values({
        deliveryId: current.id,
        userId: actor.id,
        reason: valid.reason,
        attachmentUrl: valid.attachmentUrl,
        createdAt: updated.updatedAt,
      })
      .returning();

    return { delivery: updated, override };
  });
}

// ─── Tâche 5.6 : Bilan par livreur ────────────────────────────────────────────

export type CourierBalanceSummary = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  employmentType: "EMPLOYEE" | "INDEPENDENT";
  attached: boolean;
  assignedPendingPickup: number;
  pickedUpTotal: number;
  delivered: number;
  forcedDelivered: number;
  returnReceived: number;
  activeInTour: number;
  returning: number;
  inProgress: number;
  isSettled: boolean;
};

/** Calcule le bilan des colis par livreur : Colis pris = livrés + retours + en cours. */
export async function getCourierSummaries(
  db: Executor,
  actor: CompanyUserIdentity,
): Promise<CourierBalanceSummary[]> {
  if (!can(userActor(actor), "couriers.manage", { companyId: actor.companyId }).allowed) {
    throw new DeliveryError(
      "FORBIDDEN",
      "Le bilan des livreurs est réservé à l'admin entreprise et au gestionnaire.",
    );
  }

  const courierRows = await db
    .select({
      courierId: couriers.id,
      courierName: couriers.name,
      courierPhone: couriers.phone,
      employmentType: companyCouriers.employmentType,
      attached: companyCouriers.isActive,
    })
    .from(companyCouriers)
    .innerJoin(couriers, eq(couriers.id, companyCouriers.courierId))
    .where(tenantScope(db, actor.companyId).filter(companyCouriers))
    .orderBy(asc(couriers.name));

  const deliveryRows = await db
    .select({
      courierId: deliveries.courierId,
      status: deliveries.status,
      proofMethod: deliveries.proofMethod,
    })
    .from(deliveries)
    .where(
      tenantScope(db, actor.companyId).filter(
        deliveries,
        eq(deliveries.isTest, false),
        isNotNull(deliveries.courierId),
      ),
    );

  const byCourier = new Map<string, CourierBalanceSummary>();
  for (const row of courierRows) {
    byCourier.set(row.courierId, {
      courierId: row.courierId,
      courierName: row.courierName,
      courierPhone: row.courierPhone,
      employmentType: row.employmentType,
      attached: row.attached,
      assignedPendingPickup: 0,
      pickedUpTotal: 0,
      delivered: 0,
      forcedDelivered: 0,
      returnReceived: 0,
      activeInTour: 0,
      returning: 0,
      inProgress: 0,
      isSettled: true,
    });
  }

  for (const d of deliveryRows) {
    if (!d.courierId) continue;
    const summary = byCourier.get(d.courierId);
    if (!summary) continue;

    switch (d.status) {
      case "ASSIGNED":
        summary.assignedPendingPickup += 1;
        break;
      case "DELIVERED":
        summary.delivered += 1;
        if (d.proofMethod === "MANUAL") summary.forcedDelivered += 1;
        break;
      case "RETURN_RECEIVED":
        summary.returnReceived += 1;
        break;
      case "PICKED_UP":
      case "ARRIVED":
      case "DELIVERY_FAILED":
        summary.activeInTour += 1;
        break;
      case "RETURNING":
        summary.returning += 1;
        break;
    }
  }

  for (const summary of byCourier.values()) {
    summary.inProgress = summary.activeInTour + summary.returning;
    summary.pickedUpTotal = summary.delivered + summary.returnReceived + summary.inProgress;
    summary.isSettled = summary.inProgress === 0;
  }

  return [...byCourier.values()];
}
