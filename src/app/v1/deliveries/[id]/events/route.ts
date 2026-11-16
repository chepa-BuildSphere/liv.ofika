import { db } from "@/db";
import { handleV1GetDeliveryEvents } from "@/lib/api-keys/v1-handlers";
import { jsonV1Response, requireV1ApiKey } from "@/lib/api-keys/v1-http";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const res = await handleV1GetDeliveryEvents(db, auth.apiKey, id);
  return jsonV1Response(res);
}
