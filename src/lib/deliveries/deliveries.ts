import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, ne, type SQL } from "drizzle-orm";
import {
  auditEvents,
  companies,
  companyCouriers,
  couriers,
  deliveries,
  deliveryAttempts,
  manualOverrides,
  returnReceptions,
  users,
} from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { AuthenticatedApiKey } from "@/lib/api-keys/api-keys";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import type { CourierIdentity } from "@/lib/auth/courier";
import { can, courierActor, userActor, type Actor } from "@/lib/auth/permissions";
import { tenantScope } from "@/lib/tenant/scope";
import { enqueueDeliveryWebhookEvent, webhookEventForStatus } from "@/lib/webhooks/webhooks";
import { normalizePhone, PHONE_HINT } from "@/lib/validation";
import {
  DeliveryError,
  normalizeGpsCoords,
  UUID_RE,
  type DeliveryErrorCode,
  type DeliveryField,
  type GpsCoordsInput,
} from "./errors";
import { renderDeliveryLabelPdf } from "./label-pdf";
import {
  chooseCourierAfterFailure,
  declareCourierFailure,
  forceDeliverDelivery,
  getCourierSummaries,
  listReturningDeliveriesGroupedByCourier,
  matchReturningDeliveryByScan,
  receiveDeliveryReturn,
  validateFailureDeclarationInput,
  validateForceDeliveredInput,
  validateReturnReceptionInput,
  type CourierBalanceSummary,
  type CourierReturningGroup,
  type DeclareFailureInput,
  type FailureValidationResult,
  type ForceDeliveredInput,
  type ForceDeliveredValidationResult,
  type ReceivedReturnItem,
  type ReturningDeliveryItem,
  type ReturnReceptionInput,
  type ReturnReceptionValidationResult,
  type ValidatedFailureInput,
  type ValidatedForceDeliveredInput,
  type ValidatedReturnReceptionInput,
} from "./failure-return";
import {
  buildClientConfirmUrl,
  getPublicQrStatus,
  issueDeliveryQrToken,
  MAX_HANDOVER_ATTEMPTS,
  QR_TOKEN_TTL_MS,
  scanDeliveryQrToken,
  verifyDeliveryHandoverCode,
  type IssuedQrToken,
  type PublicDeliverySummary,
  type PublicQrStatus,
  type ScanQrResult,
  type VerifyHandoverResult,
} from "./qr-token";
import { changeDeliveryStatus, TransitionRefused } from "./status";
import {
  AFTER_FAILURE_CHOICES,
  AFTER_FAILURE_LABEL,
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUSES,
  deliveryStatusLabel,
  FAILURE_REASON_LABEL,
  FAILURE_REASONS,
  FORCE_DELIVERED_FROM,
  LOCKED_STATUSES,
  RETURN_CONDITION_LABEL,
  RETURN_CONDITIONS,
  type AfterFailureChoice,
  type DeliveryStatus,
  type FailureReason,
  type ProofMethod,
  type ReturnCondition,
} from "./transitions";

export {
  AFTER_FAILURE_CHOICES,
  AFTER_FAILURE_LABEL,
  buildClientConfirmUrl,
  chooseCourierAfterFailure,
  declareCourierFailure,
  DELIVERY_STATUS_LABEL,
  DeliveryError,
  deliveryStatusLabel,
  FAILURE_REASON_LABEL,
  FAILURE_REASONS,
  FORCE_DELIVERED_FROM,
  forceDeliverDelivery,
  getCourierSummaries,
  getPublicQrStatus,
  issueDeliveryQrToken,
  listReturningDeliveriesGroupedByCourier,
  matchReturningDeliveryByScan,
  MAX_HANDOVER_ATTEMPTS,
  normalizeGpsCoords,
  QR_TOKEN_TTL_MS,
  receiveDeliveryReturn,
  RETURN_CONDITION_LABEL,
  RETURN_CONDITIONS,
  scanDeliveryQrToken,
  validateFailureDeclarationInput,
  validateForceDeliveredInput,
  validateReturnReceptionInput,
  verifyDeliveryHandoverCode,
  type AfterFailureChoice,
  type CourierBalanceSummary,
  type CourierReturningGroup,
  type DeclareFailureInput,
  type DeliveryErrorCode,
  type DeliveryField,
  type FailureReason,
  type FailureValidationResult,
  type ForceDeliveredInput,
  type ForceDeliveredValidationResult,
  type GpsCoordsInput,
  type IssuedQrToken,
  type PublicDeliverySummary,
  type PublicQrStatus,
  type ReceivedReturnItem,
  type ReturningDeliveryItem,
  type ReturnCondition,
  type ReturnReceptionInput,
  type ReturnReceptionValidationResult,
  type ScanQrResult,
  type ValidatedFailureInput,
  type ValidatedForceDeliveredInput,
  type ValidatedReturnReceptionInput,
  type VerifyHandoverResult,
};

export type CreateDeliveryInput = {
  reference: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  district?: string | null;
  packageDescription?: string | null;
  /** Montant entier en F CFA (ou chaîne issue d'un formulaire). */
  amountToCollect?: number | string | null;
  comment?: string | null;
  metadata?: Record<string, unknown> | null;
  proofMode?: "QR" | "QR_OTP" | string | null;
};

export type ValidatedDeliveryInput = {
  reference: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  district: string | null;
  packageDescription: string | null;
  amountToCollect: number | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  proofMode: "QR";
};

export type ValidationResult =
  | { ok: true; data: ValidatedDeliveryInput }
  | { ok: false; fields: Partial<Record<DeliveryField, string>> };

const MAX_AMOUNT_CFA = 100_000_000;

function parseAmountToCollect(raw: number | string | null | undefined): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw >= 0 && raw <= MAX_AMOUNT_CFA ? { ok: true, value: raw } : { ok: false };
  }
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d+$/.test(s)) return { ok: false };
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= 0 && n <= MAX_AMOUNT_CFA ? { ok: true, value: n } : { ok: false };
}

function optionalText(
  raw: string | null | undefined,
  maxLen: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  if (s.length > maxLen) return { ok: false, error: `${maxLen} caractères maximum.` };
  return { ok: true, value: s };
}

/** Validation pure des champs d'une livraison (utilisée côté service et tests unitaires). */
export function validateDeliveryInput(input: CreateDeliveryInput): ValidationResult {
  const fields: Partial<Record<DeliveryField, string>> = {};

  const reference = (input.reference ?? "").trim();
  if (reference.length < 1 || reference.length > 100) {
    fields.reference = "Indiquez une référence de commande (1 à 100 caractères).";
  }

  const recipientName = (input.recipientName ?? "").trim();
  if (recipientName.length < 2 || recipientName.length > 100) {
    fields.recipientName = "Entre 2 et 100 caractères.";
  }

  const recipientPhone = normalizePhone(input.recipientPhone ?? "");
  if (!recipientPhone) {
    fields.recipientPhone = PHONE_HINT;
  }

  const address = (input.address ?? "").trim();
  if (address.length < 2 || address.length > 250) {
    fields.address = "Indiquez l'adresse de livraison (2 à 250 caractères).";
  }

  const district = optionalText(input.district, 100);
  if (!district.ok) fields.district = district.error;

  const packageDescription = optionalText(input.packageDescription, 250);
  if (!packageDescription.ok) fields.packageDescription = packageDescription.error;

  const amount = parseAmountToCollect(input.amountToCollect);
  if (!amount.ok) {
    fields.amountToCollect = "Montant entier positif ou nul en F CFA (sans virgule).";
  }

  const comment = optionalText(input.comment, 500);
  if (!comment.ok) fields.comment = comment.error;

  let metadata: Record<string, unknown> | null = null;
  if (input.metadata !== undefined && input.metadata !== null) {
    if (typeof input.metadata !== "object" || Array.isArray(input.metadata)) {
      fields.metadata = "Données metadata invalides.";
    } else {
      metadata = input.metadata;
    }
  }

  const rawProof = (input.proofMode ?? "").trim();
  if (rawProof === "QR_OTP") {
    fields.proofMode = "L'option QR + OTP est bientôt disponible (en maintenance dans le MVP).";
  } else if (rawProof && rawProof !== "QR") {
    fields.proofMode = "Mode de preuve invalide.";
  }

  if (Object.keys(fields).length > 0 || !recipientPhone || !district.ok || !packageDescription.ok || !amount.ok || !comment.ok) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    data: {
      reference,
      recipientName,
      recipientPhone,
      address,
      district: district.value,
      packageDescription: packageDescription.value,
      amountToCollect: amount.value,
      comment: comment.value,
      metadata,
      proofMode: "QR",
    },
  };
}

export type EnterpriseCaller = CompanyUserIdentity | AuthenticatedApiKey;

export function isApiKeyCaller(caller: EnterpriseCaller): caller is AuthenticatedApiKey {
  return "environment" in caller;
}

function toPermissionActor(caller: EnterpriseCaller): Actor {
  if (isApiKeyCaller(caller)) {
    return { kind: "apiKey", id: caller.id, companyId: caller.companyId };
  }
  return userActor(caller);
}

function callerAuditRef(caller: EnterpriseCaller): { actorType: "USER" | "API_KEY"; actorId: string } {
  return isApiKeyCaller(caller)
    ? { actorType: "API_KEY", actorId: caller.id }
    : { actorType: "USER", actorId: caller.id };
}

function assertCanCreate(actor: EnterpriseCaller) {
  if (!can(toPermissionActor(actor), "delivery.create", { companyId: actor.companyId }).allowed) {
    throw new DeliveryError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
  }
}

export async function createDelivery(
  db: Executor,
  actor: EnterpriseCaller,
  input: CreateDeliveryInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  assertCanCreate(actor);

  const check = validateDeliveryInput(input);
  if (!check.ok) {
    throw new DeliveryError("INVALID", "Formulaire incomplet.", check.fields);
  }
  const clean = check.data;
  const isTest = isApiKeyCaller(actor) ? actor.isTest : false;
  const auditActor = callerAuditRef(actor);

  return db.transaction(async (tx) => {
    const existing = await tenantScope(tx, actor.companyId).selectAll(
      deliveries,
      eq(deliveries.isTest, isTest),
      eq(deliveries.reference, clean.reference),
    );
    if (existing.length > 0) {
      throw new DeliveryError("DUPLICATE_REFERENCE", "Cette référence existe déjà.", {
        reference: "Cette référence est déjà utilisée par une de vos livraisons.",
      });
    }

    const [row] = await tenantScope(tx, actor.companyId).insert(deliveries, {
      ...clean,
      status: "CREATED",
      isTest,
    });

    await logEvent(tx, {
      companyId: actor.companyId,
      deliveryId: row.id,
      eventType: "DELIVERY_CREATED",
      actorType: auditActor.actorType,
      actorId: auditActor.actorId,
      fromStatus: null,
      toStatus: "CREATED",
      payload: {
        reference: row.reference,
        recipientName: row.recipientName,
        recipientPhone: row.recipientPhone,
        address: row.address,
        district: row.district,
        amountToCollect: row.amountToCollect,
        proofMode: row.proofMode,
        ...(isTest ? { livemode: false } : {}),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await enqueueDeliveryWebhookEvent(tx, {
      companyId: actor.companyId,
      eventType: "delivery.created",
      delivery: row,
      courierName: null,
      occurredAt: row.createdAt,
    });

    return row;
  });
}

export type DeliveryFilters = {
  status?: DeliveryStatus | string | null;
  /** UUID d'un livreur, ou "UNASSIGNED" pour les livraisons sans livreur. */
  courierId?: string | null;
  /** Jour au format YYYY-MM-DD (fuseau Africa/Abidjan = UTC). */
  date?: string | null;
  /** Début de période YYYY-MM-DD (inclus). */
  from?: string | null;
  /** Fin de période YYYY-MM-DD (inclus). */
  to?: string | null;
  /** Recherche par référence de commande. */
  reference?: string | null;
  /** Inclure les livraisons créées en mode test (cachées par défaut côté entreprise). */
  includeTest?: boolean | string | null;
};

export type NormalizedDeliveryFilters = {
  status: DeliveryStatus | null;
  courierId: string | "UNASSIGNED" | null;
  date: string | null;
  from: string | null;
  to: string | null;
  startUtc: Date | null;
  endExclusiveUtc: Date | null;
  reference: string | null;
  includeTest: boolean;
};

export type DeliveryListItem = typeof deliveries.$inferSelect & {
  courierName: string | null;
  courierPhone: string | null;
};

// Regex déplacée dans ./errors.ts pour éviter tout cycle avec ./qr-token.ts.
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseValidYmd(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!YMD_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return s;
}

/** Normalise et assainit les paramètres de filtre (statut, livreur, date, référence). */
export function normalizeDeliveryFilters(raw: DeliveryFilters = {}): NormalizedDeliveryFilters {
  const rawStatus = (raw.status ?? "").trim();
  const status = (DELIVERY_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as DeliveryStatus)
    : null;

  const rawCourier = (raw.courierId ?? "").trim();
  const courierId = rawCourier === "UNASSIGNED" || UUID_RE.test(rawCourier) ? rawCourier : null;

  const date = parseValidYmd(raw.date);
  const from = date ?? parseValidYmd(raw.from);
  const to = date ?? parseValidYmd(raw.to);

  const startUtc = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const endExclusiveUtc = to ? new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) : null;

  const reference = (raw.reference ?? "").trim().slice(0, 100) || null;
  const includeTest = raw.includeTest === true || raw.includeTest === "true" || raw.includeTest === "1";

  return { status, courierId, date, from, to, startUtc, endExclusiveUtc, reference, includeTest };
}

export async function listDeliveries(
  db: Executor,
  actor: EnterpriseCaller,
  rawFilters: DeliveryFilters = {},
): Promise<DeliveryListItem[]> {
  assertCanCreate(actor);
  const f = normalizeDeliveryFilters(rawFilters);

  const conditions: SQL[] = [];
  if (isApiKeyCaller(actor)) {
    conditions.push(eq(deliveries.isTest, actor.isTest));
  } else if (!f.includeTest) {
    conditions.push(eq(deliveries.isTest, false));
  }
  if (f.status) conditions.push(eq(deliveries.status, f.status));
  if (f.courierId === "UNASSIGNED") {
    conditions.push(isNull(deliveries.courierId));
  } else if (f.courierId) {
    conditions.push(eq(deliveries.courierId, f.courierId));
  }
  if (f.startUtc) conditions.push(gte(deliveries.createdAt, f.startUtc));
  if (f.endExclusiveUtc) conditions.push(lt(deliveries.createdAt, f.endExclusiveUtc));
  if (f.reference) {
    const escapedRef = f.reference.replace(/[\\%_]/g, "\\$&");
    conditions.push(ilike(deliveries.reference, `%${escapedRef}%`));
  }

  const rows = await db
    .select({
      delivery: deliveries,
      courierName: couriers.name,
      courierPhone: couriers.phone,
    })
    .from(deliveries)
    .leftJoin(couriers, eq(couriers.id, deliveries.courierId))
    .where(tenantScope(db, actor.companyId).filter(deliveries, ...conditions))
    .orderBy(desc(deliveries.createdAt));

  return rows.map((r) => ({
    ...r.delivery,
    courierName: r.courierName ?? null,
    courierPhone: r.courierPhone ?? null,
  }));
}

export async function updateDelivery(
  db: Executor,
  actor: EnterpriseCaller,
  deliveryId: string,
  input: CreateDeliveryInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const permActor = toPermissionActor(actor);
  const auditActor = callerAuditRef(actor);
  const keyEnvFilter = isApiKeyCaller(actor) ? [eq(deliveries.isTest, actor.isTest)] : [];

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(tenantScope(tx, actor.companyId).filter(deliveries, eq(deliveries.id, deliveryId), ...keyEnvFilter))
      .for("update");

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(permActor, "delivery.editBeforePickup", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      if (!can(permActor, "delivery.create", { companyId: actor.companyId }).allowed) {
        throw new DeliveryError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
      }
      throw new DeliveryError("AFTER_PICKUP", "Impossible de modifier une livraison après sa prise en charge.");
    }

    const check = validateDeliveryInput(input);
    if (!check.ok) {
      throw new DeliveryError("INVALID", "Formulaire incomplet.", check.fields);
    }

    if (check.data.reference !== current.reference) {
      const duplicates = await tenantScope(tx, actor.companyId).selectAll(
        deliveries,
        eq(deliveries.isTest, current.isTest),
        eq(deliveries.reference, check.data.reference),
        ne(deliveries.id, current.id),
      );
      if (duplicates.length > 0) {
        throw new DeliveryError("DUPLICATE_REFERENCE", "Cette référence existe déjà.", {
          reference: "Cette référence est déjà utilisée par une de vos livraisons.",
        });
      }
    }

    const [updated] = await tenantScope(tx, actor.companyId).update(
      deliveries,
      {
        ...check.data,
        metadata: input.metadata === undefined ? current.metadata : check.data.metadata,
        updatedAt: new Date(),
      },
      eq(deliveries.id, current.id),
    );

    await logEvent(tx, {
      companyId: current.companyId,
      deliveryId: current.id,
      eventType: "DELIVERY_UPDATED",
      actorType: auditActor.actorType,
      actorId: auditActor.actorId,
      fromStatus: current.status,
      toStatus: current.status,
      payload: {
        before: {
          reference: current.reference,
          recipientName: current.recipientName,
          recipientPhone: current.recipientPhone,
          address: current.address,
          district: current.district,
          packageDescription: current.packageDescription,
          amountToCollect: current.amountToCollect,
          comment: current.comment,
        },
        after: {
          reference: updated.reference,
          recipientName: updated.recipientName,
          recipientPhone: updated.recipientPhone,
          address: updated.address,
          district: updated.district,
          packageDescription: updated.packageDescription,
          amountToCollect: updated.amountToCollect,
          comment: updated.comment,
        },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  });
}

export async function cancelDelivery(
  db: Executor,
  actor: EnterpriseCaller,
  deliveryId: string,
  reason?: string | null,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const permActor = toPermissionActor(actor);
  const auditActor = callerAuditRef(actor);
  const keyEnvFilter = isApiKeyCaller(actor) ? [eq(deliveries.isTest, actor.isTest)] : [];

  return db.transaction(async (tx) => {
    const [current] = await tenantScope(tx, actor.companyId).selectAll(
      deliveries,
      eq(deliveries.id, deliveryId),
      ...keyEnvFilter,
    );
    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(permActor, "delivery.cancelBeforePickup", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      if (!can(permActor, "delivery.create", { companyId: actor.companyId }).allowed) {
        throw new DeliveryError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
      }
      throw new DeliveryError("AFTER_PICKUP", "Impossible d'annuler une livraison après sa prise en charge.");
    }

    const cleanReason = reason?.trim().slice(0, 500) || undefined;
    try {
      return await changeDeliveryStatus(tx, {
        companyId: actor.companyId,
        deliveryId: current.id,
        to: "CANCELLED",
        actor: auditActor,
        context: {
          ip: meta.ip,
          userAgent: meta.userAgent,
          payload: cleanReason ? { reason: cleanReason } : undefined,
        },
      });
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError("AFTER_PICKUP", "Impossible d'annuler une livraison après sa prise en charge.");
      }
      throw e;
    }
  });
}

export async function assignCourier(
  db: Executor,
  actor: EnterpriseCaller,
  deliveryId: string,
  courierId: string | null,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const targetCourierId = courierId?.trim() || null;
  if (targetCourierId !== null && !UUID_RE.test(targetCourierId)) {
    throw new DeliveryError("INVALID", "Livreur introuvable.", {
      courierId: "Choisissez un livreur rattaché à votre entreprise.",
    });
  }

  const permActor = toPermissionActor(actor);
  const auditActor = callerAuditRef(actor);
  const keyEnvFilter = isApiKeyCaller(actor) ? [eq(deliveries.isTest, actor.isTest)] : [];

  return db.transaction(async (tx) => {
    const [current] = await tenantScope(tx, actor.companyId).selectAll(
      deliveries,
      eq(deliveries.id, deliveryId),
      ...keyEnvFilter,
    );
    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(permActor, "delivery.assignCourier", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      if (!can(permActor, "delivery.create", { companyId: actor.companyId }).allowed) {
        throw new DeliveryError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
      }
      throw new DeliveryError(
        "AFTER_PICKUP",
        "Impossible d'affecter ou réaffecter un livreur après la prise en charge.",
      );
    }

    if (targetCourierId === null) {
      if (current.status === "CREATED") return current;
      try {
        return await changeDeliveryStatus(tx, {
          companyId: actor.companyId,
          deliveryId: current.id,
          to: "CREATED",
          actor: auditActor,
          context: {
            ip: meta.ip,
            userAgent: meta.userAgent,
            payload: { previousCourierId: current.courierId, unassigned: true },
          },
        });
      } catch (e) {
        if (e instanceof TransitionRefused) {
          throw new DeliveryError(
            "AFTER_PICKUP",
            "Impossible d'affecter ou réaffecter un livreur après la prise en charge.",
          );
        }
        throw e;
      }
    }

    const [link] = await tenantScope(tx, actor.companyId).selectAll(
      companyCouriers,
      eq(companyCouriers.courierId, targetCourierId),
      eq(companyCouriers.isActive, true),
    );
    const [courierRow] = link
      ? await tx.select({ isActive: couriers.isActive }).from(couriers).where(eq(couriers.id, targetCourierId)).limit(1)
      : [];

    if (!link || !courierRow?.isActive) {
      throw new DeliveryError("INVALID", "Ce livreur n'est pas rattaché à votre entreprise.", {
        courierId: "Choisissez un livreur actif rattaché à votre entreprise.",
      });
    }

    if (current.status === "ASSIGNED" && current.courierId === targetCourierId) {
      return current;
    }

    try {
      return await changeDeliveryStatus(tx, {
        companyId: actor.companyId,
        deliveryId: current.id,
        to: "ASSIGNED",
        courierId: targetCourierId,
        actor: auditActor,
        context: { ip: meta.ip, userAgent: meta.userAgent },
      });
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError(
          "AFTER_PICKUP",
          "Impossible d'affecter ou réaffecter un livreur après la prise en charge.",
        );
      }
      throw e;
    }
  });
}

const COURIER_VISIBLE_STATUSES: readonly DeliveryStatus[] = [
  "ASSIGNED",
  "PICKED_UP",
  "ARRIVED",
  "DELIVERY_FAILED",
  "RETURNING",
];

export type CourierDeliveryItem = Omit<typeof deliveries.$inferSelect, "recipientPhone"> & {
  recipientPhone: string | null;
};

/** Colis affectés / en cours visibles par le livreur, limités aux entreprises où il est actif. */
export async function listCourierDeliveries(
  db: Executor,
  courier: CourierIdentity,
): Promise<CourierDeliveryItem[]> {
  if (courier.companies.length === 0) return [];
  const companyIds = courier.companies.map((c) => c.id);
  const actor = courierActor(courier);

  // tenant-guard: livreur — filtre sur courierId et ses entreprises actives (courier.companies)
  const rows = await db
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.courierId, courier.id),
        eq(deliveries.isTest, false),
        inArray(deliveries.companyId, companyIds),
        inArray(deliveries.status, COURIER_VISIBLE_STATUSES),
      ),
    )
    .orderBy(desc(deliveries.assignedAt), desc(deliveries.createdAt));

  return rows
    .filter((d) =>
      can(actor, "delivery.view", { companyId: d.companyId, status: d.status, courierId: d.courierId }).allowed,
    )
    .map((d) => {
      const canViewPhone = can(actor, "delivery.viewRecipientContact", {
        companyId: d.companyId,
        status: d.status,
        courierId: d.courierId,
      }).allowed;
      return {
        ...d,
        recipientPhone: canViewPhone ? d.recipientPhone : null,
      };
    });
}

/** Prise en charge unitaire ou multiple par le livreur affecté (→ PICKED_UP + heure serveur). */
export async function confirmCourierPickup(
  db: Executor,
  courier: CourierIdentity,
  deliveryIds: readonly string[],
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ pickedUpCount: number; deliveries: (typeof deliveries.$inferSelect)[] }> {
  const uniqueIds = [...new Set(deliveryIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0 || uniqueIds.some((id) => !UUID_RE.test(id))) {
    throw new DeliveryError("INVALID", "Sélectionnez au moins un colis valide à prendre en charge.");
  }

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérifié via can(courierActor(courier), "delivery.confirmPickup", ...)
    const rows = await tx
      .select()
      .from(deliveries)
      .where(and(inArray(deliveries.id, uniqueIds), eq(deliveries.isTest, false)));

    if (rows.length !== uniqueIds.length) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const actor = courierActor(courier);
    for (const row of rows) {
      const decision = can(actor, "delivery.confirmPickup", {
        companyId: row.companyId,
        status: row.status,
        courierId: row.courierId,
      });
      if (!decision.allowed) {
        throw new DeliveryError(
          "FORBIDDEN",
          "Vous ne pouvez prendre en charge que les colis qui vous sont affectés.",
        );
      }
      if (row.status !== "ASSIGNED") {
        throw new DeliveryError(
          "AFTER_PICKUP",
          "Seuls les colis au statut Affectée peuvent être pris en charge au départ.",
        );
      }
    }

    const byId = new Map(rows.map((r) => [r.id, r]));
    const updated: (typeof deliveries.$inferSelect)[] = [];
    for (const id of uniqueIds) {
      const row = byId.get(id)!;
      const next = await changeDeliveryStatus(tx, {
        companyId: row.companyId,
        deliveryId: row.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: courier.id },
        context: { ip: meta.ip, userAgent: meta.userAgent },
      });
      updated.push(next);
    }

    return { pickedUpCount: updated.length, deliveries: updated };
  });
}

type AuditRow = typeof auditEvents.$inferSelect;

export type DeliveryTimelineEvent = {
  id: number;
  eventType: string;
  label: string;
  summary: string | null;
  actorType: AuditRow["actorType"];
  actorId: string | null;
  actorName: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus | null;
  lat: AuditRow["lat"];
  lng: AuditRow["lng"];
  accuracy: AuditRow["accuracy"];
  serverTime: Date;
  hash: string;
};

export type DeliveryManualOverrideDetail = {
  reason: string;
  attachmentUrl: string | null;
  userName: string;
  createdAt: Date;
};

export type DeliveryReturnReceptionDetail = {
  condition: ReturnCondition;
  comment: string | null;
  photoUrl: string | null;
  receivedByName: string;
  receivedAt: Date;
};

export type DeliveryDetail = {
  delivery: Omit<typeof deliveries.$inferSelect, "recipientPhone"> & {
    recipientPhone: string | null;
  };
  courierName: string | null;
  canViewContact: boolean;
  canEdit: boolean;
  canGeneratePdf: boolean;
  canForceDelivered: boolean;
  cannotForceDeliveredReason: string | null;
  manualOverride: DeliveryManualOverrideDetail | null;
  returnReception: DeliveryReturnReceptionDetail | null;
  timeline: DeliveryTimelineEvent[];
};

const UPDATED_FIELD_LABELS: Record<string, string> = {
  reference: "référence",
  recipientName: "destinataire",
  recipientPhone: "téléphone",
  address: "adresse",
  district: "quartier",
  packageDescription: "description",
  amountToCollect: "montant",
  comment: "commentaire",
};

const PROOF_METHOD_LABELS: Record<string, string> = {
  QR: "QR code",
  QR_OTP: "QR code + OTP",
  OTP: "Code OTP",
  MANUAL: "Validation manuelle",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveCourierLabel(id: unknown, courierNames?: Map<string, string>): string | null {
  if (typeof id !== "string" || !id) return null;
  return courierNames?.get(id) ?? "Livreur";
}

/** Formate un événement d'audit en libellé et résumé lisibles pour la timeline. */
export function describeDeliveryEvent(
  ev: Pick<AuditRow, "eventType" | "fromStatus" | "toStatus" | "payload">,
  courierNames?: Map<string, string>,
): { label: string; summary: string | null } {
  const payload = asRecord(ev.payload);

  switch (ev.eventType) {
    case "DELIVERY_CREATED": {
      if (payload?.unassigned === true) {
        const prev = resolveCourierLabel(payload.previousCourierId, courierNames);
        return {
          label: "Livreur retiré",
          summary: prev ? `Précédemment affectée à ${prev}` : "Livraison remise en attente d'affectation",
        };
      }
      const ref = cleanText(payload?.reference);
      const isCsv = payload?.source === "CSV_IMPORT" || payload?.source === "csv";
      return {
        label: isCsv ? "Livraison importée (CSV)" : "Livraison créée",
        summary: ref ? `Référence ${ref}` : null,
      };
    }

    case "DELIVERY_UPDATED": {
      const before = asRecord(payload?.before);
      const after = asRecord(payload?.after);
      if (!before || !after) {
        return { label: "Livraison modifiée", summary: null };
      }
      const changed = Object.keys(UPDATED_FIELD_LABELS).filter(
        (k) => (before[k] ?? null) !== (after[k] ?? null),
      );
      return {
        label: "Livraison modifiée",
        summary:
          changed.length > 0
            ? `Champs modifiés : ${changed.map((k) => UPDATED_FIELD_LABELS[k]).join(", ")}`
            : null,
      };
    }

    case "DELIVERY_ASSIGNED": {
      const next = resolveCourierLabel(payload?.courierId, courierNames);
      const prev = resolveCourierLabel(payload?.previousCourierId, courierNames);
      const reassigned = ev.fromStatus === "ASSIGNED" || prev !== null;
      return {
        label: reassigned ? "Livreur réaffecté" : "Livreur affecté",
        summary: reassigned
          ? prev && next
            ? `${prev} → ${next}`
            : next
              ? `Affectée à ${next}`
              : null
          : next
            ? `Affectée à ${next}`
            : null,
      };
    }

    case "DELIVERY_PICKED_UP": {
      if (ev.fromStatus === "DELIVERY_FAILED") {
        return {
          label: "Nouvelle tentative de livraison",
          summary: "Colis repris en tournée après un échec",
        };
      }
      return { label: "Colis récupéré", summary: null };
    }

    case "DELIVERY_ARRIVED": {
      const attemptNum =
        typeof payload?.attemptNumber === "number" && payload.attemptNumber > 1
          ? `Tentative n°${payload.attemptNumber}`
          : null;
      const missingGps = payload?.gpsMissing === true ? "GPS absent" : null;
      const parts = [attemptNum, missingGps].filter((p): p is string => p !== null);
      return {
        label: "Livreur arrivé sur place",
        summary: parts.length > 0 ? parts.join(" · ") : null,
      };
    }

    case "DELIVERY_DELIVERED": {
      const method = cleanText(payload?.proofMethod);
      const proof = method ? (PROOF_METHOD_LABELS[method] ?? method) : null;
      return {
        label: "Livraison effectuée",
        summary: proof ? `Preuve : ${proof}` : null,
      };
    }

    case "DELIVERY_FORCED_DELIVERED": {
      const reason = cleanText(payload?.reason);
      return {
        label: "Livraison validée manuellement",
        summary: reason ? `Motif : ${reason}` : null,
      };
    }

    case "DELIVERY_DELIVERY_FAILED":
    case "DELIVERY_FAILED": {
      const reason = cleanText(payload?.reason);
      return {
        label: "Échec de livraison",
        summary: reason ? `Motif : ${reason}` : null,
      };
    }

    case "DELIVERY_RETURNING":
      return { label: "Retour en cours", summary: null };

    case "DELIVERY_RETURN_RECEIVED": {
      const condRaw = cleanText(payload?.condition);
      const condLabel =
        condRaw && condRaw in RETURN_CONDITION_LABEL
          ? RETURN_CONDITION_LABEL[condRaw as ReturnCondition]
          : null;
      const comment = cleanText(payload?.comment);
      const parts = [condLabel ? `État : ${condLabel}` : null, comment].filter(
        (p): p is string => p !== null,
      );
      return {
        label: "Retour réceptionné",
        summary: parts.length > 0 ? parts.join(" — ") : null,
      };
    }

    case "DELIVERY_CANCELLED": {
      const reason = cleanText(payload?.reason);
      return {
        label: "Livraison annulée",
        summary: reason ? `Motif : ${reason}` : null,
      };
    }

    case "QR_GENERATED": {
      const revoked =
        typeof payload?.revokedPreviousCount === "number" ? payload.revokedPreviousCount : 0;
      return {
        label: revoked > 0 ? "Nouveau QR de validation généré" : "QR de validation généré",
        summary: revoked > 0 ? "Ancien QR invalidé · valable 3 minutes" : "Valable 3 minutes",
      };
    }

    case "QR_SCANNED":
      return {
        label: "QR scanné par le destinataire",
        summary:
          payload?.gpsMissing === true
            ? "Code à 4 chiffres affiché · GPS absent"
            : "Code à 4 chiffres affiché",
      };

    case "SAME_DEVICE_REJECTED":
      return {
        label: "Scan depuis l'appareil du livreur refusé",
        summary: "Le client doit scanner depuis son propre téléphone",
      };

    case "QR_CODE_REJECTED": {
      const remaining =
        typeof payload?.remainingAttempts === "number" ? payload.remainingAttempts : null;
      return {
        label: "Code de remise incorrect",
        summary:
          remaining !== null
            ? `${remaining} essai${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`
            : null,
      };
    }

    case "QR_LOCKED":
      return {
        label: "QR verrouillé (3 codes faux)",
        summary: "Génération d'un nouveau QR requise",
      };

    case "SUSPICIOUS_DEVICE_REUSE":
      return {
        label: "Alerte : même appareil client réutilisé",
        summary: "Même empreinte utilisée sur plusieurs livraisons du livreur",
      };

    default: {
      if (ev.toStatus && ev.toStatus in DELIVERY_STATUS_LABEL) {
        return {
          label: `Statut : ${DELIVERY_STATUS_LABEL[ev.toStatus]}`,
          summary: null,
        };
      }
      return { label: ev.eventType, summary: null };
    }
  }
}

function resolveActorName(
  ev: Pick<AuditRow, "actorType" | "actorId">,
  userNames: Map<string, string>,
  courierNames: Map<string, string>,
): string {
  switch (ev.actorType) {
    case "SYSTEM":
      return "Système";
    case "API_KEY":
      return "Clé API";
    case "PLATFORM_ADMIN":
      return "Support Ofika";
    case "USER":
      return (ev.actorId && userNames.get(ev.actorId)) ?? "Utilisateur";
    case "COURIER":
      return (ev.actorId && courierNames.get(ev.actorId)) ?? "Livreur";
    case "RECIPIENT":
      return "Destinataire";
  }
}

/** Détail complet d'une livraison et sa timeline d'historique filtrée selon le rôle. */
export async function getDeliveryDetail(
  db: Executor,
  actor: EnterpriseCaller,
  deliveryId: string,
): Promise<DeliveryDetail> {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const keyEnvFilter = isApiKeyCaller(actor) ? [eq(deliveries.isTest, actor.isTest)] : [];

  const [row] = await db
    .select({
      delivery: deliveries,
      courierName: couriers.name,
    })
    .from(deliveries)
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .where(tenantScope(db, actor.companyId).filter(deliveries, eq(deliveries.id, deliveryId), ...keyEnvFilter))
    .limit(1);

  if (!row) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const companyUser = toPermissionActor(actor);
  const resource = {
    companyId: row.delivery.companyId,
    status: row.delivery.status,
    courierId: row.delivery.courierId,
  };

  if (!can(companyUser, "delivery.view", resource).allowed) {
    throw new DeliveryError("FORBIDDEN", "Vous n'avez pas accès à cette livraison.");
  }

  const canViewContact = can(companyUser, "delivery.viewRecipientContact", resource).allowed;
  const canEdit = can(companyUser, "delivery.create", { companyId: row.delivery.companyId }).allowed;
  const canGeneratePdf = can(companyUser, "delivery.generatePdf", resource).allowed;
  const isAdmin = !isApiKeyCaller(actor) && actor.roles.includes("COMPANY_ADMIN");
  const canForceStatus = FORCE_DELIVERED_FROM.includes(row.delivery.status);
  const forceDecision = can(companyUser, "delivery.forceDelivered", resource);
  const canForceDelivered = canForceStatus && forceDecision.allowed;
  const cannotForceDeliveredReason =
    isAdmin && canForceStatus && !forceDecision.allowed ? forceDecision.reason : null;

  const [overrideRow] =
    row.delivery.status === "DELIVERED" && row.delivery.proofMethod === "MANUAL"
      ? await db
          .select({
            reason: manualOverrides.reason,
            attachmentUrl: manualOverrides.attachmentUrl,
            userName: users.name,
            createdAt: manualOverrides.createdAt,
          })
          .from(manualOverrides)
          .innerJoin(users, eq(manualOverrides.userId, users.id))
          .where(tenantScope(db, actor.companyId).filter(users, eq(manualOverrides.deliveryId, deliveryId)))
          .limit(1)
      : [];

  const [receptionRow] =
    row.delivery.status === "RETURN_RECEIVED"
      ? await db
          .select({
            condition: returnReceptions.condition,
            comment: returnReceptions.comment,
            photoUrl: returnReceptions.photoUrl,
            receivedByName: users.name,
            receivedAt: returnReceptions.receivedAt,
          })
          .from(returnReceptions)
          .innerJoin(users, eq(returnReceptions.receivedByUserId, users.id))
          .where(tenantScope(db, actor.companyId).filter(users, eq(returnReceptions.deliveryId, deliveryId)))
          .limit(1)
      : [];

  const rawEvents = await db
    .select()
    .from(auditEvents)
    .where(tenantScope(db, actor.companyId).filter(auditEvents, eq(auditEvents.deliveryId, deliveryId)))
    .orderBy(asc(auditEvents.serverTime), asc(auditEvents.id));

  const visibleEvents = rawEvents.filter((ev) => {
    const concernsReturn =
      ev.fromStatus === "RETURNING" ||
      ev.fromStatus === "RETURN_RECEIVED" ||
      ev.toStatus === "RETURNING" ||
      ev.toStatus === "RETURN_RECEIVED" ||
      ev.eventType.includes("RETURN");
    return can(companyUser, "audit.view", {
      companyId: ev.companyId ?? row.delivery.companyId,
      actorType: ev.actorType,
      actorId: ev.actorId,
      concernsReturn,
    }).allowed;
  });

  const userIds = new Set<string>();
  const courierIds = new Set<string>();
  for (const ev of visibleEvents) {
    if (ev.actorType === "USER" && ev.actorId) userIds.add(ev.actorId);
    if (ev.actorType === "COURIER" && ev.actorId) courierIds.add(ev.actorId);
    const payload = asRecord(ev.payload);
    if (typeof payload?.courierId === "string" && UUID_RE.test(payload.courierId)) {
      courierIds.add(payload.courierId);
    }
    if (typeof payload?.previousCourierId === "string" && UUID_RE.test(payload.previousCourierId)) {
      courierIds.add(payload.previousCourierId);
    }
  }

  const userNames = new Map<string, string>();
  if (userIds.size > 0) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(tenantScope(db, actor.companyId).filter(users, inArray(users.id, [...userIds])));
    for (const u of userRows) userNames.set(u.id, u.name);
  }

  const courierNames = new Map<string, string>();
  if (courierIds.size > 0) {
    const courierRows = await db
      .select({ id: couriers.id, name: couriers.name })
      .from(couriers)
      .where(inArray(couriers.id, [...courierIds]));
    for (const c of courierRows) courierNames.set(c.id, c.name);
  }

  const timeline: DeliveryTimelineEvent[] = visibleEvents.map((ev) => {
    const described = describeDeliveryEvent(ev, courierNames);
    return {
      id: ev.id,
      eventType: ev.eventType,
      label: described.label,
      summary: described.summary,
      actorType: ev.actorType,
      actorId: ev.actorId,
      actorName: resolveActorName(ev, userNames, courierNames),
      fromStatus: ev.fromStatus,
      toStatus: ev.toStatus,
      lat: ev.lat,
      lng: ev.lng,
      accuracy: ev.accuracy,
      serverTime: ev.serverTime,
      hash: ev.hash,
    };
  });

  return {
    delivery: {
      ...row.delivery,
      recipientPhone: canViewContact ? row.delivery.recipientPhone : null,
    },
    courierName: row.courierName,
    canViewContact,
    canEdit,
    canGeneratePdf,
    canForceDelivered,
    cannotForceDeliveredReason,
    manualOverride: overrideRow ?? null,
    returnReception: receptionRow ?? null,
    timeline,
  };
}

/** Génère le bordereau PDF (avec QR de référence) si l'acteur est autorisé. */
export async function generateDeliveryLabelPdf(
  db: Executor,
  actor: EnterpriseCaller,
  deliveryId: string,
): Promise<{ filename: string; pdf: Uint8Array; reference: string }> {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const keyEnvFilter = isApiKeyCaller(actor) ? [eq(deliveries.isTest, actor.isTest)] : [];

  const [row] = await db
    .select({
      delivery: deliveries,
      companyName: companies.name,
      courierName: couriers.name,
    })
    .from(deliveries)
    .innerJoin(companies, eq(deliveries.companyId, companies.id))
    .leftJoin(couriers, eq(deliveries.courierId, couriers.id))
    .where(tenantScope(db, actor.companyId).filter(deliveries, eq(deliveries.id, deliveryId), ...keyEnvFilter))
    .limit(1);

  if (!row) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const decision = can(toPermissionActor(actor), "delivery.generatePdf", {
    companyId: row.delivery.companyId,
    status: row.delivery.status,
    courierId: row.delivery.courierId,
  });
  if (!decision.allowed) {
    throw new DeliveryError("FORBIDDEN", "Vous n'avez pas accès au bordereau PDF de cette livraison.");
  }

  const safeRef =
    row.delivery.reference
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || row.delivery.id;

  const pdf = renderDeliveryLabelPdf({
    id: row.delivery.id,
    companyName: row.companyName,
    reference: row.delivery.reference,
    status: row.delivery.status,
    proofMethod: row.delivery.proofMethod,
    proofMode: row.delivery.proofMode,
    recipientName: row.delivery.recipientName,
    recipientPhone: row.delivery.recipientPhone,
    address: row.delivery.address,
    district: row.delivery.district,
    packageDescription: row.delivery.packageDescription,
    amountToCollect: row.delivery.amountToCollect,
    comment: row.delivery.comment,
    courierName: row.courierName,
    createdAt: row.delivery.createdAt,
  });

  return {
    filename: `bordereau-${safeRef}.pdf`,
    pdf,
    reference: row.delivery.reference,
  };
}

/** Déclare l'arrivée du livreur chez le destinataire avec capture GPS et création de tentative numérotée. */
export async function declareCourierArrived(
  db: Executor,
  courier: CourierIdentity,
  deliveryId: string,
  gps?: GpsCoordsInput | null,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{
  delivery: typeof deliveries.$inferSelect;
  attempt: typeof deliveryAttempts.$inferSelect;
  gpsMissing: boolean;
}> {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  return db.transaction(async (tx) => {
    // tenant-guard: livreur — vérifié via can(courierActor(courier), "delivery.declareArrived", ...)
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.isTest, false)))
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    const decision = can(courierActor(courier), "delivery.declareArrived", {
      companyId: current.companyId,
      status: current.status,
      courierId: current.courierId,
    });
    if (!decision.allowed) {
      throw new DeliveryError("FORBIDDEN", "Vous ne pouvez déclarer l'arrivée que pour vos propres colis.");
    }

    const coords = normalizeGpsCoords(gps);
    let updated: typeof deliveries.$inferSelect;
    try {
      updated = await changeDeliveryStatus(tx, {
        companyId: current.companyId,
        deliveryId: current.id,
        to: "ARRIVED",
        actor: { actorType: "COURIER", actorId: courier.id },
        context: {
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          ip: meta.ip,
          userAgent: meta.userAgent,
          payload: { gpsMissing: coords.gpsMissing },
        },
      });
    } catch (e) {
      if (e instanceof TransitionRefused) {
        throw new DeliveryError(
          "INVALID",
          "Le colis doit être au statut Prise en charge pour déclarer l'arrivée.",
        );
      }
      throw e;
    }

    const [attempt] = await tx
      .select()
      .from(deliveryAttempts)
      .where(
        and(
          eq(deliveryAttempts.deliveryId, updated.id),
          eq(deliveryAttempts.attemptNumber, updated.currentAttempt),
        ),
      )
      .limit(1);

    return {
      delivery: updated,
      attempt,
      gpsMissing: coords.gpsMissing,
    };
  });
}

export const SIMULATABLE_STATUSES = [
  "ASSIGNED",
  "PICKED_UP",
  "ARRIVED",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNING",
  "RETURN_RECEIVED",
] as const;

export type SimulatableStatus = (typeof SIMULATABLE_STATUSES)[number];

/**
 * Simule le passage de statut d'une livraison créée en mode test (`is_test = true`).
 * Réservé aux clés API de mode test (`ofk_test_…`) ; jamais facturée (`billedPrice = 0`).
 */
export async function simulateTestDeliveryStatus(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
  input: {
    status: string;
    courierId?: string | null;
    failureReason?: string | null;
    reason?: string | null;
  },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<typeof deliveries.$inferSelect> {
  if (!apiKey.isTest) {
    throw new DeliveryError(
      "FORBIDDEN",
      "La route de simulation est réservée aux clés API de mode test (ofk_test_…).",
    );
  }

  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison de test introuvable.");
  }

  const rawStatus = (input.status ?? "").trim();
  const targetStatus = (SIMULATABLE_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as SimulatableStatus)
    : null;
  if (!targetStatus) {
    throw new DeliveryError(
      "INVALID",
      `Statut simulable invalide. Valeurs acceptées : ${SIMULATABLE_STATUSES.join(", ")}.`,
    );
  }

  const rawFailure = (input.failureReason ?? "").trim();
  const validFailureReason = rawFailure
    ? (FAILURE_REASONS as readonly string[]).includes(rawFailure)
      ? rawFailure
      : null
    : undefined;
  if (rawFailure && !validFailureReason) {
    throw new DeliveryError("INVALID", "Motif d'échec invalide.");
  }

  const targetCourierId = input.courierId?.trim() || null;
  if (targetCourierId && !UUID_RE.test(targetCourierId)) {
    throw new DeliveryError("INVALID", "Identifiant livreur invalide.", {
      courierId: "Choisissez un livreur valide.",
    });
  }

  const cleanReason = input.reason?.trim().slice(0, 500) || null;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(deliveries)
      .where(
        tenantScope(tx, apiKey.companyId).filter(
          deliveries,
          eq(deliveries.id, deliveryId),
          eq(deliveries.isTest, true),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) {
      throw new DeliveryError("NOT_FOUND", "Livraison de test introuvable.");
    }

    if (LOCKED_STATUSES.includes(current.status)) {
      throw new DeliveryError("INVALID", `La livraison de test est déjà verrouillée (${current.status}).`);
    }

    if (current.status === targetStatus) {
      throw new DeliveryError("INVALID", `La livraison de test est déjà au statut ${targetStatus}.`);
    }

    const now = new Date();
    const changes: Partial<typeof deliveries.$inferInsert> = {
      status: targetStatus,
      updatedAt: now,
    };

    let assignedCourierId: string | null = current.courierId;
    if (targetStatus === "ASSIGNED" && targetCourierId) {
      const [link] = await tenantScope(tx, apiKey.companyId).selectAll(
        companyCouriers,
        eq(companyCouriers.courierId, targetCourierId),
        eq(companyCouriers.isActive, true),
      );
      const [courierRow] = link
        ? await tx
            .select({ isActive: couriers.isActive })
            .from(couriers)
            .where(eq(couriers.id, targetCourierId))
            .limit(1)
        : [];
      if (!link || !courierRow?.isActive) {
        throw new DeliveryError("INVALID", "Ce livreur n'est pas rattaché à votre entreprise.", {
          courierId: "Choisissez un livreur actif rattaché à votre entreprise.",
        });
      }
      assignedCourierId = targetCourierId;
      changes.courierId = targetCourierId;
      changes.assignedAt = now;
    }

    switch (targetStatus) {
      case "ASSIGNED":
        changes.assignedAt = current.assignedAt ?? now;
        break;
      case "PICKED_UP":
        changes.pickedUpAt = current.pickedUpAt ?? now;
        break;
      case "ARRIVED":
        changes.currentAttempt = current.currentAttempt + 1;
        break;
      case "DELIVERED":
        changes.proofMethod = "QR";
        changes.deliveredAt = now;
        changes.billedPrice = null;
        if (current.currentAttempt === 0) changes.currentAttempt = 1;
        break;
      case "DELIVERY_FAILED":
        if (current.currentAttempt === 0) changes.currentAttempt = 1;
        break;
    }

    const [updated] = await tenantScope(tx, apiKey.companyId).update(
      deliveries,
      changes,
      eq(deliveries.id, current.id),
    );

    await logEvent(tx, {
      companyId: apiKey.companyId,
      deliveryId: current.id,
      eventType: `DELIVERY_${targetStatus}`,
      actorType: "API_KEY",
      actorId: apiKey.id,
      fromStatus: current.status,
      toStatus: targetStatus,
      payload: {
        simulated: true,
        livemode: false,
        ...(assignedCourierId ? { courierId: assignedCourierId } : {}),
        ...(targetStatus === "DELIVERED" ? { proofMethod: "QR", billedPrice: null } : {}),
        ...(targetStatus === "DELIVERY_FAILED"
          ? { failureReason: validFailureReason ?? "RECIPIENT_ABSENT" }
          : {}),
        ...(cleanReason ? { reason: cleanReason } : {}),
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    const simWebhookEvent = webhookEventForStatus(current.status, targetStatus);
    if (simWebhookEvent) {
      await enqueueDeliveryWebhookEvent(tx, {
        companyId: apiKey.companyId,
        eventType: simWebhookEvent,
        delivery: updated,
        failureReason:
          targetStatus === "DELIVERY_FAILED" ? (validFailureReason ?? "RECIPIENT_ABSENT") : null,
        occurredAt: now,
      });
    }

    return updated;
  });
}
