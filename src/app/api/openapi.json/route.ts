import { NextResponse } from "next/server";
import { OFIKA_OPENAPI_SPEC } from "@/lib/api-keys/openapi-spec";

export function GET() {
  return NextResponse.json(OFIKA_OPENAPI_SPEC, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
