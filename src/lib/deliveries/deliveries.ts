import { desc, eq, gte, ilike, isNull, lt, type SQL } from "drizzle-orm";
import { couriers, deliveries } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, userActor } from "@/lib/auth/permissions";
import { tenantScope } from "@/lib/tenant/scope";
import { normalizePhone, PHONE_HINT } from "@/lib/validation";
import { DELIVERY_STATUSES, type DeliveryStatus } from "./transitions";

export type DeliveryErrorCode = "FORBIDDEN" | "INVALID" | "DUPLICATE_REFERENCE";

export type DeliveryField =
  | "reference"
  | "recipientName"
  | "recipientPhone"
  | "address"
  | "district"
  | "packageDescription"
  | "amountToCollect"
  | "comment"
  | "metadata"
  | "proofMode";

export class DeliveryError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    message: string,
    readonly fields?: Partial<Record<DeliveryField, string>>,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

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

function assertCanCreate(actor: CompanyUserIdentity) {
  if (!can(userActor(actor), "delivery.create", { companyId: actor.companyId }).allowed) {
    throw new DeliveryError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
  }
}

export async function createDelivery(
  db: Executor,
  actor: CompanyUserIdentity,
  input: CreateDeliveryInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  assertCanCreate(actor);

  const check = validateDeliveryInput(input);
  if (!check.ok) {
    throw new DeliveryError("INVALID", "Formulaire incomplet.", check.fields);
  }
  const clean = check.data;

  return db.transaction(async (tx) => {
    const existing = await tenantScope(tx, actor.companyId).selectAll(
      deliveries,
      eq(deliveries.isTest, false),
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
      isTest: false,
    });

    await logEvent(tx, {
      companyId: actor.companyId,
      deliveryId: row.id,
      eventType: "DELIVERY_CREATED",
      actorType: "USER",
      actorId: actor.id,
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
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
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
};

export type DeliveryListItem = typeof deliveries.$inferSelect & {
  courierName: string | null;
  courierPhone: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

  return { status, courierId, date, from, to, startUtc, endExclusiveUtc, reference };
}

export async function listDeliveries(
  db: Executor,
  actor: CompanyUserIdentity,
  rawFilters: DeliveryFilters = {},
): Promise<DeliveryListItem[]> {
  assertCanCreate(actor);
  const f = normalizeDeliveryFilters(rawFilters);

  const conditions: SQL[] = [eq(deliveries.isTest, false)];
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
