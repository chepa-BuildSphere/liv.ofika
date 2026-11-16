import { NextResponse } from "next/server";
import { db } from "@/db";
import { getPublicQrStatus } from "@/lib/deliveries/deliveries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const status = await getPublicQrStatus(db, token);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
