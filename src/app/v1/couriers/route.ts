import { db } from "@/db";
import { handleV1ListCouriers } from "@/lib/api-keys/v1-handlers";
import { jsonV1Response, requireV1ApiKey } from "@/lib/api-keys/v1-http";

export async function GET(req: Request) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const res = await handleV1ListCouriers(db, auth.apiKey);
  return jsonV1Response(res);
}
