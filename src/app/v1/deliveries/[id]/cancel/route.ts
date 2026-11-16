import { db } from "@/db";
import { handleV1CancelDelivery } from "@/lib/api-keys/v1-handlers";
import {
  jsonV1Response,
  readJsonBody,
  readV1RequestContext,
  requireV1ApiKey,
} from "@/lib/api-keys/v1-http";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const ctx = await readV1RequestContext(req);
  const res = await handleV1CancelDelivery(db, auth.apiKey, id, parsed.body, {
    idempotencyKey: ctx.idempotencyKey,
    rawBody: parsed.rawBody,
    meta: ctx.meta,
  });
  return jsonV1Response(res);
}
