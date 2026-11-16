import type { deliveries } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { CourierError, listCouriers } from "@/lib/couriers/couriers";
import { importDeliveriesFromCsv } from "@/lib/deliveries/csv-import";
import {
  assignCourier,
  cancelDelivery,
  createDelivery,
  DeliveryError,
  generateDeliveryLabelPdf,
  getDeliveryDetail,
  listDeliveries,
  simulateTestDeliveryStatus,
  updateDelivery,
  type CreateDeliveryInput,
  type DeliveryFilters,
} from "@/lib/deliveries/deliveries";
import type { AuthenticatedApiKey } from "./api-keys";
import { computeIdempotencyRequestHash, runIdempotentPost, type IdempotentResponse } from "./idempotency";

export type V1JsonResult = {
  status: number;
  body: Record<string, unknown>;
  replayed?: boolean;
};

function asText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Sérialise une livraison pour les réponses REST `/v1/*`. */
export function serializeV1Delivery(
  d: Pick<
    typeof deliveries.$inferSelect,
    | "id"
    | "reference"
    | "metadata"
    | "status"
    | "proofMode"
    | "proofMethod"
    | "isTest"
    | "recipientName"
    | "address"
    | "district"
    | "packageDescription"
    | "amountToCollect"
    | "comment"
    | "courierId"
    | "currentAttempt"
    | "billedPrice"
    | "assignedAt"
    | "pickedUpAt"
    | "deliveredAt"
    | "cancelledAt"
    | "createdAt"
    | "updatedAt"
  > & { recipientPhone: string | null },
  extra?: { courierName?: string | null },
): Record<string, unknown> {
  return {
    id: d.id,
    reference: d.reference,
    metadata: d.metadata ?? null,
    status: d.status,
    proof_mode: d.proofMode,
    proof_method: d.proofMethod ?? null,
    livemode: !d.isTest,
    is_test: d.isTest,
    recipient_name: d.recipientName,
    recipient_phone: d.recipientPhone,
    address: d.address,
    district: d.district ?? null,
    package_description: d.packageDescription ?? null,
    amount_to_collect: d.amountToCollect ?? null,
    comment: d.comment ?? null,
    courier_id: d.courierId ?? null,
    ...(extra?.courierName !== undefined ? { courier_name: extra.courierName } : {}),
    current_attempt: d.currentAttempt,
    billed_price: d.billedPrice ?? null,
    assigned_at: d.assignedAt ? d.assignedAt.toISOString() : null,
    picked_up_at: d.pickedUpAt ? d.pickedUpAt.toISOString() : null,
    delivered_at: d.deliveredAt ? d.deliveredAt.toISOString() : null,
    cancelled_at: d.cancelledAt ? d.cancelledAt.toISOString() : null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

function readDeliveryPayload(rawBody: Record<string, unknown>): CreateDeliveryInput {
  const rawMetadata = rawBody.metadata;
  const rawProofMode = rawBody.proof_mode !== undefined ? rawBody.proof_mode : rawBody.proofMode;
  const rawAmount =
    rawBody.amount_to_collect !== undefined ? rawBody.amount_to_collect : rawBody.amountToCollect;

  return {
    reference: asText(rawBody.reference) ?? "",
    recipientName: asText(rawBody.recipient_name ?? rawBody.recipientName) ?? "",
    recipientPhone: asText(rawBody.recipient_phone ?? rawBody.recipientPhone) ?? "",
    address: asText(rawBody.address) ?? "",
    district: asNullableText(rawBody.district),
    packageDescription: asNullableText(rawBody.package_description ?? rawBody.packageDescription),
    amountToCollect:
      rawAmount === undefined
        ? undefined
        : (rawAmount as number | string | null),
    comment: asNullableText(rawBody.comment),
    metadata: rawMetadata as Record<string, unknown> | null | undefined,
    proofMode: rawProofMode as string | null | undefined,
  };
}

function deliveryErrorResponse(e: DeliveryError): { status: number; body: Record<string, unknown> } {
  const statusMap: Record<DeliveryError["code"], number> = {
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    DUPLICATE_REFERENCE: 409,
    AFTER_PICKUP: 409,
    INVALID: 400,
  };
  return {
    status: statusMap[e.code],
    body: {
      error: {
        code: e.code,
        message: e.message,
        ...(e.fields ? { fields: e.fields } : {}),
      },
    },
  };
}

function toResult(res: IdempotentResponse): V1JsonResult {
  return { status: res.status, body: res.body, replayed: res.replayed };
}

export async function handleV1CreateDelivery(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  body: Record<string, unknown>,
  opts: {
    idempotencyKey?: string | null;
    rawBody?: string;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<V1JsonResult> {
  const rawHashInput = opts.rawBody ?? JSON.stringify(body);
  const requestHash = computeIdempotencyRequestHash("POST", "/v1/deliveries", rawHashInput);

  const res = await runIdempotentPost(db, apiKey, opts.idempotencyKey, requestHash, async (tx) => {
    try {
      const created = await createDelivery(tx, apiKey, readDeliveryPayload(body), opts.meta);
      return { status: 201, body: { data: serializeV1Delivery(created) } };
    } catch (e) {
      if (e instanceof DeliveryError) return deliveryErrorResponse(e);
      throw e;
    }
  });

  return toResult(res);
}

export async function handleV1ImportDeliveries(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  csvText: string,
  opts: {
    idempotencyKey?: string | null;
    rawBody?: string;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<V1JsonResult> {
  const requestHash = computeIdempotencyRequestHash(
    "POST",
    "/v1/deliveries/import",
    opts.rawBody ?? csvText,
  );

  const res = await runIdempotentPost(db, apiKey, opts.idempotencyKey, requestHash, async (tx) => {
    try {
      const result = await importDeliveriesFromCsv(tx, apiKey, csvText, opts.meta);
      if (!result.ok) {
        return {
          status: 400,
          body: {
            error: {
              code: result.code,
              message: result.message,
              ...(result.missingColumns ? { missing_columns: result.missingColumns } : {}),
            },
          },
        };
      }
      return {
        status: result.importedCount > 0 ? 201 : 200,
        body: {
          livemode: apiKey.livemode,
          total_rows: result.totalRows,
          imported_count: result.importedCount,
          data: result.imported.map((d) => serializeV1Delivery(d)),
          errors: result.errors.map((err) => ({
            line_number: err.lineNumber,
            reference: err.reference,
            message: err.message,
          })),
        },
      };
    } catch (e) {
      if (e instanceof DeliveryError) return deliveryErrorResponse(e);
      throw e;
    }
  });

  return toResult(res);
}

export async function handleV1ListDeliveries(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  filters: DeliveryFilters = {},
): Promise<V1JsonResult> {
  try {
    const rows = await listDeliveries(db, apiKey, filters);
    return {
      status: 200,
      body: {
        livemode: apiKey.livemode,
        data: rows.map((d) => serializeV1Delivery(d, { courierName: d.courierName })),
      },
    };
  } catch (e) {
    if (e instanceof DeliveryError) return deliveryErrorResponse(e);
    throw e;
  }
}

export async function handleV1GetDelivery(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
): Promise<V1JsonResult> {
  try {
    const detail = await getDeliveryDetail(db, apiKey, deliveryId);
    return {
      status: 200,
      body: {
        data: serializeV1Delivery(detail.delivery, { courierName: detail.courierName }),
      },
    };
  } catch (e) {
    if (e instanceof DeliveryError) return deliveryErrorResponse(e);
    throw e;
  }
}

export async function handleV1PatchDelivery(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
  body: Record<string, unknown>,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<V1JsonResult> {
  try {
    const detail = await getDeliveryDetail(db, apiKey, deliveryId);
    const cur = detail.delivery;
    const patchInput = readDeliveryPayload(body);

    const hasRef = body.reference !== undefined;
    const hasRecipientName = body.recipient_name !== undefined || body.recipientName !== undefined;
    const hasRecipientPhone = body.recipient_phone !== undefined || body.recipientPhone !== undefined;
    const hasAddress = body.address !== undefined;
    const hasDistrict = body.district !== undefined;
    const hasDesc = body.package_description !== undefined || body.packageDescription !== undefined;
    const hasAmount = body.amount_to_collect !== undefined || body.amountToCollect !== undefined;
    const hasComment = body.comment !== undefined;
    const hasProofMode = body.proof_mode !== undefined || body.proofMode !== undefined;

    const merged: CreateDeliveryInput = {
      reference: hasRef ? patchInput.reference : cur.reference,
      recipientName: hasRecipientName ? patchInput.recipientName : cur.recipientName,
      recipientPhone: hasRecipientPhone ? patchInput.recipientPhone : (cur.recipientPhone ?? ""),
      address: hasAddress ? patchInput.address : cur.address,
      district: hasDistrict ? patchInput.district : cur.district,
      packageDescription: hasDesc ? patchInput.packageDescription : cur.packageDescription,
      amountToCollect: hasAmount ? patchInput.amountToCollect : cur.amountToCollect,
      comment: hasComment ? patchInput.comment : cur.comment,
      metadata: body.metadata !== undefined ? patchInput.metadata : undefined,
      proofMode: hasProofMode ? patchInput.proofMode : cur.proofMode,
    };

    const updated = await updateDelivery(db, apiKey, deliveryId, merged, meta);
    return { status: 200, body: { data: serializeV1Delivery(updated) } };
  } catch (e) {
    if (e instanceof DeliveryError) return deliveryErrorResponse(e);
    throw e;
  }
}

export async function handleV1AssignDelivery(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
  body: Record<string, unknown>,
  opts: {
    idempotencyKey?: string | null;
    rawBody?: string;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<V1JsonResult> {
  const requestHash = computeIdempotencyRequestHash(
    "POST",
    `/v1/deliveries/${deliveryId}/assign`,
    opts.rawBody ?? JSON.stringify(body),
  );
  const rawCourier = body.courier_id !== undefined ? body.courier_id : body.courierId;
  const courierId = typeof rawCourier === "string" ? rawCourier : null;

  const res = await runIdempotentPost(db, apiKey, opts.idempotencyKey, requestHash, async (tx) => {
    try {
      const updated = await assignCourier(tx, apiKey, deliveryId, courierId, opts.meta);
      return { status: 200, body: { data: serializeV1Delivery(updated) } };
    } catch (e) {
      if (e instanceof DeliveryError) return deliveryErrorResponse(e);
      throw e;
    }
  });

  return toResult(res);
}

export async function handleV1CancelDelivery(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
  body: Record<string, unknown>,
  opts: {
    idempotencyKey?: string | null;
    rawBody?: string;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<V1JsonResult> {
  const requestHash = computeIdempotencyRequestHash(
    "POST",
    `/v1/deliveries/${deliveryId}/cancel`,
    opts.rawBody ?? JSON.stringify(body),
  );
  const reason = typeof body.reason === "string" ? body.reason : null;

  const res = await runIdempotentPost(db, apiKey, opts.idempotencyKey, requestHash, async (tx) => {
    try {
      const updated = await cancelDelivery(tx, apiKey, deliveryId, reason, opts.meta);
      return { status: 200, body: { data: serializeV1Delivery(updated) } };
    } catch (e) {
      if (e instanceof DeliveryError) return deliveryErrorResponse(e);
      throw e;
    }
  });

  return toResult(res);
}

export async function handleV1GetDeliveryEvents(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
): Promise<V1JsonResult> {
  try {
    const detail = await getDeliveryDetail(db, apiKey, deliveryId);
    return {
      status: 200,
      body: {
        delivery_id: detail.delivery.id,
        reference: detail.delivery.reference,
        livemode: apiKey.livemode,
        data: detail.timeline.map((ev) => ({
          id: ev.id,
          event_type: ev.eventType,
          label: ev.label,
          summary: ev.summary,
          actor_type: ev.actorType,
          from_status: ev.fromStatus,
          to_status: ev.toStatus,
          server_time: ev.serverTime.toISOString(),
          hash: ev.hash,
        })),
      },
    };
  } catch (e) {
    if (e instanceof DeliveryError) return deliveryErrorResponse(e);
    throw e;
  }
}

export async function handleV1GetDeliveryLabelPdf(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
): Promise<
  | { ok: true; filename: string; pdf: Uint8Array }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  try {
    const res = await generateDeliveryLabelPdf(db, apiKey, deliveryId);
    return { ok: true, filename: res.filename, pdf: res.pdf };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { ok: false, ...deliveryErrorResponse(e) };
    }
    throw e;
  }
}

export async function handleV1ListCouriers(
  db: Executor,
  apiKey: AuthenticatedApiKey,
): Promise<V1JsonResult> {
  try {
    const list = await listCouriers(db, apiKey);
    return {
      status: 200,
      body: {
        livemode: apiKey.livemode,
        data: list
          .filter((c) => c.attached)
          .map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            employment_type: c.employmentType,
          })),
      },
    };
  } catch (e) {
    if (e instanceof CourierError) {
      return {
        status: e.code === "FORBIDDEN" ? 403 : 400,
        body: { error: { code: e.code, message: e.message } },
      };
    }
    throw e;
  }
}

export async function handleV1SimulateDelivery(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  deliveryId: string,
  body: Record<string, unknown>,
  opts: {
    idempotencyKey?: string | null;
    rawBody?: string;
    meta?: { ip?: string | null; userAgent?: string | null };
  } = {},
): Promise<V1JsonResult> {
  const requestHash = computeIdempotencyRequestHash(
    "POST",
    `/v1/test/deliveries/${deliveryId}/simulate`,
    opts.rawBody ?? JSON.stringify(body),
  );

  const payload = asRecord(body);
  const res = await runIdempotentPost(db, apiKey, opts.idempotencyKey, requestHash, async (tx) => {
    try {
      const updated = await simulateTestDeliveryStatus(
        tx,
        apiKey,
        deliveryId,
        {
          status: asText(payload.status) ?? "",
          courierId: asNullableText(payload.courier_id ?? payload.courierId),
          failureReason: asNullableText(payload.failure_reason ?? payload.failureReason),
          reason: asNullableText(payload.reason),
        },
        opts.meta,
      );
      return { status: 200, body: { data: serializeV1Delivery(updated) } };
    } catch (e) {
      if (e instanceof DeliveryError) return deliveryErrorResponse(e);
      throw e;
    }
  });

  return toResult(res);
}
