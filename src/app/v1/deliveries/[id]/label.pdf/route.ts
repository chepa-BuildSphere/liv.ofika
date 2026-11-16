import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleV1GetDeliveryLabelPdf } from "@/lib/api-keys/v1-handlers";
import { requireV1ApiKey } from "@/lib/api-keys/v1-http";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireV1ApiKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const res = await handleV1GetDeliveryLabelPdf(db, auth.apiKey, id);
  if (!res.ok) {
    return NextResponse.json(res.body, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(new Uint8Array(res.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${res.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
