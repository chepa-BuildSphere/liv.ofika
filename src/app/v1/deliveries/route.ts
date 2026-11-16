import { db } from "@/db";
import {
  handleV1CreateDelivery,
  handleV1ListDeliveries,
} from "@/lib/api-keys/v1-handlers";
import {
  jsonV1Response,
  readJsonBody,
  readV1RequestContext,
  requireV1ApiKey,
} from "@/lib/api-keys/v1-http";

export async function GET(req: Request) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const res = await handleV1ListDeliveries(db, auth.apiKey, {
    status: searchParams.get("status"),
    courierId: searchParams.get("courier_id") ?? searchParams.get("courierId"),
    date: searchParams.get("date"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    reference: searchParams.get("reference"),
  });
  return jsonV1Response(res);
}

export async function POST(req: Request) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const ctx = await readV1RequestContext(req);
  const res = await handleV1CreateDelivery(db, auth.apiKey, parsed.body, {
    idempotencyKey: ctx.idempotencyKey,
    rawBody: parsed.rawBody,
    meta: ctx.meta,
  });
  return jsonV1Response(res);
}
