import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleV1ImportDeliveries } from "@/lib/api-keys/v1-handlers";
import {
  jsonV1Response,
  readV1RequestContext,
  requireV1ApiKey,
} from "@/lib/api-keys/v1-http";

export async function POST(req: Request) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  let csvText = rawBody;

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody || "{}") as Record<string, unknown>;
      const rawCsv = parsed.csv ?? parsed.csv_text ?? parsed.csvText;
      csvText = typeof rawCsv === "string" ? rawCsv : "";
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Corps JSON invalide." } },
        { status: 400 },
      );
    }
  }

  const ctx = await readV1RequestContext(req);
  const res = await handleV1ImportDeliveries(db, auth.apiKey, csvText, {
    idempotencyKey: ctx.idempotencyKey,
    rawBody,
    meta: ctx.meta,
  });
  return jsonV1Response(res);
}
