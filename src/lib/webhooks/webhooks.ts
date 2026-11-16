import { createHmac } from "node:crypto";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { couriers, deliveries, webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, userActor } from "@/lib/auth/permissions";
import type { DeliveryStatus } from "@/lib/deliveries/transitions";
import {
  decryptSecret,
  encryptSecret,
  randomToken,
  safeEqualHex,
  type ApiKeyEnvironment,
} from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_TYPES,
  type DispatchWebhookOutcome,
  type PublicWebhookEndpointItem,
  type WebhookDeliveryHistoryItem,
  type WebhookEventType,
} from "./webhook-types";

export {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_TYPES,
  type DispatchWebhookOutcome,
  type PublicWebhookEndpointItem,
  type WebhookDeliveryHistoryItem,
  type WebhookEventType,
};

/** Délais de nouvelle tentative en secondes : 1 min, 5 min, 30 min, 2 h. */
export const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200] as const;
export const MAX_WEBHOOK_ATTEMPTS = 5;
const DEFAULT_SIGNATURE_TOLERANCE_SEC = 300;
const MAX_URL_LEN = 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WebhookErrorCode = "FORBIDDEN" | "INVALID" | "NOT_FOUND";
export type WebhookField = "url" | "environment" | "events";

export class WebhookError extends Error {
  constructor(
    readonly code: WebhookErrorCode,
    message: string,
    readonly fields?: Partial<Record<WebhookField, string>>,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

function isDisallowedHost(rawHostname: string): boolean {
  const host = rawHostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host === "::" ||
    host.startsWith("fe80:") ||
    host.startsWith("::ffff:") ||
    /^(?:fc|fd)[0-9a-f]{0,2}:/i.test(host)
  ) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((n) => n < 0 || n > 255)) return true;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return false;
}

/** Vérifie qu'une URL webhook est HTTP(S) publique et sûre (anti-SSRF). */
export function isSafeWebhookUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > MAX_URL_LEN) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (isDisallowedHost(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export type WebhookEndpointInput = {
  url: string;
  environment: string;
  events: readonly string[];
};

export type ValidatedWebhookEndpointInput = {
  url: string;
  environment: ApiKeyEnvironment;
  events: WebhookEventType[];
};

export type WebhookValidationResult =
  | { ok: true; data: ValidatedWebhookEndpointInput }
  | { ok: false; fields: Partial<Record<WebhookField, string>> };

/** Valide l'URL (HTTP/HTTPS publique), l'environnement (TEST / LIVE) et la liste d'événements. */
export function validateWebhookEndpointInput(raw: WebhookEndpointInput): WebhookValidationResult {
  const fields: Partial<Record<WebhookField, string>> = {};

  const trimmedUrl = raw.url?.trim() ?? "";
  let cleanUrl = "";
  if (!trimmedUrl) {
    fields.url = "Indiquez l'URL de destination du webhook.";
  } else if (trimmedUrl.length > MAX_URL_LEN) {
    fields.url = `L'URL ne doit pas dépasser ${MAX_URL_LEN} caractères.`;
  } else if (!isSafeWebhookUrl(trimmedUrl)) {
    fields.url = "URL invalide ou hôte privé/local non autorisé (http:// ou https:// public requis).";
  } else {
    cleanUrl = new URL(trimmedUrl).toString();
  }

  const rawEnv = raw.environment?.trim();
  const validEnv = rawEnv === "TEST" || rawEnv === "LIVE" ? rawEnv : null;
  if (!validEnv) {
    fields.environment = "Choisissez l'environnement Test ou Production.";
  }

  const uniqueEvents: WebhookEventType[] = [];
  const invalidEvents: string[] = [];
  for (const ev of raw.events ?? []) {
    const clean = ev.trim();
    if (!clean) continue;
    if ((WEBHOOK_EVENT_TYPES as readonly string[]).includes(clean)) {
      if (!uniqueEvents.includes(clean as WebhookEventType)) {
        uniqueEvents.push(clean as WebhookEventType);
      }
    } else {
      invalidEvents.push(clean);
    }
  }
  if (invalidEvents.length > 0) {
    fields.events = `Événement(s) inconnu(s) : ${invalidEvents.join(", ")}.`;
  } else if (uniqueEvents.length === 0) {
    fields.events = "Sélectionnez au moins un événement webhook.";
  }

  if (Object.keys(fields).length > 0 || !cleanUrl || !validEnv) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    data: {
      url: cleanUrl,
      environment: validEnv,
      events: uniqueEvents,
    },
  };
}

/** Signe un corps JSON brut selon `X-Ofika-Signature: t=<horodatage>,v1=<HMAC-SHA256>`. */
export function signWebhookPayload(
  rawBody: string,
  secret: string,
  timestampSec = Math.floor(Date.now() / 1000),
): { header: string; timestamp: number; signature: string } {
  const signature = createHmac("sha256", secret)
    .update(`${timestampSec}.${rawBody}`, "utf8")
    .digest("hex");
  return {
    header: `t=${timestampSec},v1=${signature}`,
    timestamp: timestampSec,
    signature,
  };
}

/** Vérifie un en-tête `X-Ofika-Signature` (HMAC temps constant + fenêtre anti-rejeu). */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  opts: { nowSec?: number; toleranceSec?: number } = {},
): boolean {
  if (!header || !secret) return false;
  let timestamp: number | null = null;
  let signature = "";

  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === "t" && /^\d+$/.test(val)) {
      timestamp = Number(val);
    } else if (key === "v1" && /^[0-9a-f]{64}$/i.test(val)) {
      signature = val.toLowerCase();
    }
  }

  if (timestamp === null || !signature) return false;

  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const toleranceSec = opts.toleranceSec ?? DEFAULT_SIGNATURE_TOLERANCE_SEC;
  if (Math.abs(nowSec - timestamp) > toleranceSec) {
    return false;
  }

  const expected = signWebhookPayload(rawBody, secret, timestamp).signature;
  return safeEqualHex(expected, signature);
}

/** Calcule le prochain horodatage de nouvelle tentative (backoff croissant). */
export function computeNextRetryAt(attemptNumber: number, now: Date): Date {
  const idx = Math.max(0, Math.min(attemptNumber - 1, RETRY_DELAYS_SECONDS.length - 1));
  return new Date(now.getTime() + RETRY_DELAYS_SECONDS[idx] * 1000);
}

function assertCanConfigureWebhooks(actor: CompanyUserIdentity) {
  if (!can(userActor(actor), "webhooks.configure", { companyId: actor.companyId }).allowed) {
    throw new WebhookError(
      "FORBIDDEN",
      "La configuration des webhooks est réservée à l'admin entreprise.",
    );
  }
}

/** Crée un endpoint webhook, génère un secret `whsec_…` et le chiffre avec AES-256-GCM. */
export async function createWebhookEndpoint(
  db: Executor,
  actor: CompanyUserIdentity,
  input: WebhookEndpointInput,
  masterKey: Buffer,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ endpoint: PublicWebhookEndpointItem; secret: string }> {
  assertCanConfigureWebhooks(actor);

  const checked = validateWebhookEndpointInput(input);
  if (!checked.ok) {
    const firstMsg = Object.values(checked.fields)[0] ?? "Configuration webhook invalide.";
    throw new WebhookError("INVALID", firstMsg, checked.fields);
  }

  const endpointId = crypto.randomUUID();
  const secret = `whsec_${randomToken(24)}`;
  const secretEncrypted = encryptSecret(secret, masterKey, endpointId);

  return db.transaction(async (tx) => {
    const [inserted] = await tenantScope(tx, actor.companyId).insert(webhookEndpoints, {
      id: endpointId,
      url: checked.data.url,
      environment: checked.data.environment,
      secretEncrypted,
      events: checked.data.events,
      isActive: true,
    });

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "WEBHOOK_ENDPOINT_CREATED",
      actorType: "USER",
      actorId: actor.id,
      payload: {
        endpointId: inserted.id,
        url: inserted.url,
        environment: inserted.environment,
        events: inserted.events,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return {
      endpoint: {
        id: inserted.id,
        url: inserted.url,
        environment: inserted.environment,
        events: inserted.events,
        isActive: inserted.isActive,
        createdAt: inserted.createdAt,
      },
      secret,
    };
  });
}

/** Liste les endpoints webhooks configurés pour l'entreprise (sans jamais exposer le secret). */
export async function listWebhookEndpoints(
  db: Executor,
  actor: CompanyUserIdentity,
): Promise<PublicWebhookEndpointItem[]> {
  assertCanConfigureWebhooks(actor);

  const rows = await db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      environment: webhookEndpoints.environment,
      events: webhookEndpoints.events,
      isActive: webhookEndpoints.isActive,
      createdAt: webhookEndpoints.createdAt,
    })
    .from(webhookEndpoints)
    .where(tenantScope(db, actor.companyId).filter(webhookEndpoints))
    .orderBy(desc(webhookEndpoints.createdAt));

  return rows;
}

/** Active ou désactive un endpoint webhook de l'entreprise. */
export async function toggleWebhookEndpoint(
  db: Executor,
  actor: CompanyUserIdentity,
  endpointId: string,
  isActive: boolean,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<PublicWebhookEndpointItem> {
  assertCanConfigureWebhooks(actor);
  if (!UUID_RE.test(endpointId)) {
    throw new WebhookError("NOT_FOUND", "Webhook introuvable.");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tenantScope(tx, actor.companyId).update(
      webhookEndpoints,
      { isActive },
      eq(webhookEndpoints.id, endpointId),
    );
    if (!updated) {
      throw new WebhookError("NOT_FOUND", "Webhook introuvable.");
    }

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "WEBHOOK_ENDPOINT_UPDATED",
      actorType: "USER",
      actorId: actor.id,
      payload: {
        endpointId: updated.id,
        isActive: updated.isActive,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return {
      id: updated.id,
      url: updated.url,
      environment: updated.environment,
      events: updated.events,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  });
}

/** Supprime un endpoint webhook et son historique associé pour l'entreprise. */
export async function deleteWebhookEndpoint(
  db: Executor,
  actor: CompanyUserIdentity,
  endpointId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ id: string }> {
  assertCanConfigureWebhooks(actor);
  if (!UUID_RE.test(endpointId)) {
    throw new WebhookError("NOT_FOUND", "Webhook introuvable.");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tenantScope(tx, actor.companyId).selectAll(
      webhookEndpoints,
      eq(webhookEndpoints.id, endpointId),
    );
    if (!existing) {
      throw new WebhookError("NOT_FOUND", "Webhook introuvable.");
    }

    await tx.delete(webhookDeliveries).where(eq(webhookDeliveries.endpointId, existing.id));
    await tx
      .delete(webhookEndpoints)
      .where(tenantScope(tx, actor.companyId).filter(webhookEndpoints, eq(webhookEndpoints.id, existing.id)));

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "WEBHOOK_ENDPOINT_DELETED",
      actorType: "USER",
      actorId: actor.id,
      payload: {
        endpointId: existing.id,
        url: existing.url,
        environment: existing.environment,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return { id: existing.id };
  });
}

export type EnqueueDeliveryWebhookInput = {
  companyId: string;
  eventType: WebhookEventType;
  delivery: Pick<
    typeof deliveries.$inferSelect,
    | "id"
    | "reference"
    | "metadata"
    | "status"
    | "proofMethod"
    | "currentAttempt"
    | "courierId"
    | "isTest"
  >;
  courierName?: string | null;
  failureReason?: string | null;
  occurredAt?: Date;
};

/** Construit l'enveloppe standard de webhook (§9.3) incluant `reference`, `metadata` et `livemode`. */
export function buildDeliveryWebhookPayload(
  input: EnqueueDeliveryWebhookInput,
  now = new Date(),
): Record<string, unknown> {
  const occurred = input.occurredAt ?? now;
  const attemptNum = input.delivery.currentAttempt > 0 ? input.delivery.currentAttempt : 1;

  return {
    id: `evt_${randomToken(16)}`,
    type: input.eventType,
    created_at: now.toISOString(),
    livemode: !input.delivery.isTest,
    data: {
      delivery_id: input.delivery.id,
      reference: input.delivery.reference,
      metadata: input.delivery.metadata ?? null,
      status: input.delivery.status,
      proof_method: input.delivery.proofMethod ?? null,
      attempt: attemptNum,
      courier: input.courierName ? { name: input.courierName } : null,
      failure_reason: input.failureReason ?? null,
      occurred_at: occurred.toISOString(),
    },
  };
}

/**
 * Met en file les envois webhooks pour tous les endpoints actifs de l'entreprise
 * correspondant à l'environnement (`TEST` / `LIVE`) et abonnés à `eventType`.
 */
export async function enqueueDeliveryWebhookEvent(
  tx: Executor,
  input: EnqueueDeliveryWebhookInput,
): Promise<string[]> {
  const env: ApiKeyEnvironment = input.delivery.isTest ? "TEST" : "LIVE";
  const endpoints = await tenantScope(tx, input.companyId).selectAll(
    webhookEndpoints,
    eq(webhookEndpoints.environment, env),
    eq(webhookEndpoints.isActive, true),
  );

  const subscribed = endpoints.filter((ep) => ep.events.includes(input.eventType));
  if (subscribed.length === 0) return [];

  let resolvedCourierName = input.courierName;
  if (resolvedCourierName === undefined && input.delivery.courierId) {
    const [c] = await tx
      .select({ name: couriers.name })
      .from(couriers)
      .where(eq(couriers.id, input.delivery.courierId))
      .limit(1);
    resolvedCourierName = c?.name ?? null;
  }

  const now = new Date();
  const createdIds: string[] = [];
  for (const ep of subscribed) {
    const payload = buildDeliveryWebhookPayload(
      { ...input, courierName: resolvedCourierName ?? null },
      now,
    );
    const [row] = await tx
      .insert(webhookDeliveries)
      .values({
        endpointId: ep.id,
        eventType: input.eventType,
        payload,
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: now,
      })
      .returning({ id: webhookDeliveries.id });
    createdIds.push(row.id);
  }

  return createdIds;
}

/** Associe une transition de livraison à son événement webhook standard (§9.3). */
export function webhookEventForStatus(
  fromStatus: DeliveryStatus | null,
  toStatus: DeliveryStatus,
): WebhookEventType | null {
  switch (toStatus) {
    case "CREATED":
      return fromStatus === null ? "delivery.created" : null;
    case "ASSIGNED":
      return "delivery.assigned";
    case "PICKED_UP":
      return fromStatus === "DELIVERY_FAILED" ? "delivery.retry" : "delivery.picked_up";
    case "ARRIVED":
      return "delivery.arrived";
    case "DELIVERED":
      return "delivery.delivered";
    case "DELIVERY_FAILED":
      return "delivery.failed";
    case "RETURNING":
      return "delivery.returning";
    case "RETURN_RECEIVED":
      return "delivery.return_received";
    case "CANCELLED":
      return "delivery.cancelled";
    default:
      return null;
  }
}

/** Expédie une livraison webhook avec signature `X-Ofika-Signature` et gestion des nouvelles tentatives. */
export async function dispatchWebhookDelivery(
  db: Executor,
  webhookDeliveryId: string,
  opts: {
    masterKey: Buffer;
    fetcher?: typeof fetch;
    now?: Date;
  },
): Promise<DispatchWebhookOutcome> {
  // tenant-guard: file d'envoi serveur — livraison webhook identifiée par son id
  const [row] = await db
    .select({
      delivery: webhookDeliveries,
      endpoint: webhookEndpoints,
    })
    .from(webhookDeliveries)
    // tenant-guard: jointure par endpointId déjà rattaché à l'entreprise
    .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .where(eq(webhookDeliveries.id, webhookDeliveryId))
    .limit(1);

  if (!row) {
    throw new WebhookError("NOT_FOUND", "Envoi webhook introuvable.");
  }

  const now = opts.now ?? new Date();
  const startedAt = Date.now();
  const fetcher = opts.fetcher ?? fetch;

  let responseStatus: number | null = null;
  let errorMessage: string | null = null;
  let succeeded = false;

  if (!isSafeWebhookUrl(row.endpoint.url)) {
    errorMessage = "URL webhook refusée (hôte local ou privé).";
  } else {
    try {
      const secret = decryptSecret(
        row.endpoint.secretEncrypted,
        opts.masterKey,
        row.endpoint.id,
      );
      const rawBody = JSON.stringify(row.delivery.payload);
      const signed = signWebhookPayload(rawBody, secret, Math.floor(now.getTime() / 1000));

      const response = await fetcher(row.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ofika-Signature": signed.header,
          "X-Ofika-Event": row.delivery.eventType,
          "X-Ofika-Delivery": row.delivery.id,
        },
        body: rawBody,
        signal: AbortSignal.timeout(10_000),
      });
      responseStatus = response.status;
      if (response.ok) {
        succeeded = true;
      } else {
        errorMessage = `Réponse HTTP ${response.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message.slice(0, 300) : "Erreur réseau";
    }
  }

  const durationMs = Math.max(0, Date.now() - startedAt);
  const nextAttempt = row.delivery.attemptCount + 1;

  if (succeeded) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "SUCCEEDED",
        attemptCount: nextAttempt,
        lastResponseStatus: responseStatus,
        lastError: null,
        deliveredAt: now,
      })
      .where(eq(webhookDeliveries.id, row.delivery.id));

    return {
      webhookDeliveryId: row.delivery.id,
      status: "SUCCEEDED",
      responseStatus,
      durationMs,
      error: null,
    };
  }

  const exhausted = nextAttempt >= MAX_WEBHOOK_ATTEMPTS;
  const nextStatus = exhausted ? "FAILED" : "PENDING";
  const nextAttemptAt = exhausted ? now : computeNextRetryAt(nextAttempt, now);

  await db
    .update(webhookDeliveries)
    .set({
      status: nextStatus,
      attemptCount: nextAttempt,
      nextAttemptAt,
      lastResponseStatus: responseStatus,
      lastError: errorMessage,
    })
    .where(eq(webhookDeliveries.id, row.delivery.id));

  return {
    webhookDeliveryId: row.delivery.id,
    status: nextStatus,
    responseStatus,
    durationMs,
    error: errorMessage,
  };
}

/** Traite le lot d'envois webhooks `PENDING` arrivés à échéance. */
export async function processPendingWebhooks(
  db: Executor,
  opts: {
    masterKey: Buffer;
    fetcher?: typeof fetch;
    now?: Date;
    limit?: number;
  },
): Promise<DispatchWebhookOutcome[]> {
  const now = opts.now ?? new Date();
  const dueRows = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "PENDING"),
        lte(webhookDeliveries.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(webhookDeliveries.nextAttemptAt))
    .limit(opts.limit ?? 50);

  const outcomes: DispatchWebhookOutcome[] = [];
  for (const r of dueRows) {
    outcomes.push(
      await dispatchWebhookDelivery(db, r.id, {
        masterKey: opts.masterKey,
        fetcher: opts.fetcher,
        now,
      }),
    );
  }
  return outcomes;
}

/** Envoie immédiatement un événement `webhook.test` sur un endpoint et retourne le résultat. */
export async function sendTestWebhook(
  db: Executor,
  actor: CompanyUserIdentity,
  endpointId: string,
  opts: {
    masterKey: Buffer;
    fetcher?: typeof fetch;
    now?: Date;
    meta?: { ip?: string | null; userAgent?: string | null };
  },
): Promise<DispatchWebhookOutcome> {
  assertCanConfigureWebhooks(actor);
  if (!UUID_RE.test(endpointId)) {
    throw new WebhookError("NOT_FOUND", "Webhook introuvable.");
  }

  const [endpoint] = await tenantScope(db, actor.companyId).selectAll(
    webhookEndpoints,
    eq(webhookEndpoints.id, endpointId),
  );
  if (!endpoint) {
    throw new WebhookError("NOT_FOUND", "Webhook introuvable.");
  }

  const now = opts.now ?? new Date();
  const payload = {
    id: `evt_${randomToken(16)}`,
    type: "webhook.test",
    created_at: now.toISOString(),
    livemode: endpoint.environment === "LIVE",
    data: {
      delivery_id: null,
      reference: "CMD-TEST-WEBHOOK",
      metadata: { test: true, company_id: actor.companyId },
      status: null,
      proof_method: null,
      attempt: 1,
      courier: { name: "Livreur Test" },
      failure_reason: null,
      occurred_at: now.toISOString(),
    },
  };

  const [queued] = await db
    .insert(webhookDeliveries)
    .values({
      endpointId: endpoint.id,
      eventType: "webhook.test",
      payload,
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: now,
    })
    .returning({ id: webhookDeliveries.id });

  const outcome = await dispatchWebhookDelivery(db, queued.id, {
    masterKey: opts.masterKey,
    fetcher: opts.fetcher,
    now,
  });

  await logEvent(db, {
    companyId: actor.companyId,
    eventType: "WEBHOOK_TEST_SENT",
    actorType: "USER",
    actorId: actor.id,
    payload: {
      endpointId: endpoint.id,
      webhookDeliveryId: queued.id,
      status: outcome.status,
      responseStatus: outcome.responseStatus,
    },
    ip: opts.meta?.ip ?? null,
    userAgent: opts.meta?.userAgent ?? null,
  });

  return outcome;
}

/** Liste les derniers envois webhooks de l'entreprise (tâche 6.9). */
export async function listWebhookDeliveries(
  db: Executor,
  actor: CompanyUserIdentity,
  limit = 50,
): Promise<WebhookDeliveryHistoryItem[]> {
  assertCanConfigureWebhooks(actor);

  const rows = await db
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      endpointUrl: webhookEndpoints.url,
      environment: webhookEndpoints.environment,
      eventType: webhookDeliveries.eventType,
      payload: webhookDeliveries.payload,
      status: webhookDeliveries.status,
      attemptCount: webhookDeliveries.attemptCount,
      nextAttemptAt: webhookDeliveries.nextAttemptAt,
      lastResponseStatus: webhookDeliveries.lastResponseStatus,
      lastError: webhookDeliveries.lastError,
      deliveredAt: webhookDeliveries.deliveredAt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .where(tenantScope(db, actor.companyId).filter(webhookEndpoints))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const payloadObj =
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : null;
    const dataObj =
      payloadObj?.data && typeof payloadObj.data === "object" && !Array.isArray(payloadObj.data)
        ? (payloadObj.data as Record<string, unknown>)
        : null;
    const reference = typeof dataObj?.reference === "string" ? dataObj.reference : null;

    return {
      id: r.id,
      endpointId: r.endpointId,
      endpointUrl: r.endpointUrl,
      environment: r.environment,
      eventType: r.eventType,
      reference,
      status: r.status,
      attemptCount: r.attemptCount,
      nextAttemptAt: r.nextAttemptAt,
      lastResponseStatus: r.lastResponseStatus,
      lastError: r.lastError,
      deliveredAt: r.deliveredAt,
      createdAt: r.createdAt,
    };
  });
}

/** Relance immédiatement un envoi webhook de l'entreprise (« Renvoyer », tâche 6.9). */
export async function retryWebhookDelivery(
  db: Executor,
  actor: CompanyUserIdentity,
  webhookDeliveryId: string,
  opts: {
    masterKey: Buffer;
    fetcher?: typeof fetch;
    now?: Date;
    meta?: { ip?: string | null; userAgent?: string | null };
  },
): Promise<DispatchWebhookOutcome> {
  assertCanConfigureWebhooks(actor);
  if (!UUID_RE.test(webhookDeliveryId)) {
    throw new WebhookError("NOT_FOUND", "Envoi webhook introuvable.");
  }

  const [existing] = await db
    .select({
      id: webhookDeliveries.id,
      attemptCount: webhookDeliveries.attemptCount,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .where(
      tenantScope(db, actor.companyId).filter(
        webhookEndpoints,
        eq(webhookDeliveries.id, webhookDeliveryId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new WebhookError("NOT_FOUND", "Envoi webhook introuvable.");
  }

  const now = opts.now ?? new Date();
  await db
    .update(webhookDeliveries)
    .set({
      status: "PENDING",
      nextAttemptAt: now,
      attemptCount: Math.min(existing.attemptCount, MAX_WEBHOOK_ATTEMPTS - 1),
    })
    .where(eq(webhookDeliveries.id, existing.id));

  const outcome = await dispatchWebhookDelivery(db, existing.id, {
    masterKey: opts.masterKey,
    fetcher: opts.fetcher,
    now,
  });

  await logEvent(db, {
    companyId: actor.companyId,
    eventType: "WEBHOOK_DELIVERY_RETRIED",
    actorType: "USER",
    actorId: actor.id,
    payload: {
      webhookDeliveryId: existing.id,
      status: outcome.status,
      responseStatus: outcome.responseStatus,
    },
    ip: opts.meta?.ip ?? null,
    userAgent: opts.meta?.userAgent ?? null,
  });

  return outcome;
}
