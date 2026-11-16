import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { getRequestMeta } from "@/lib/request-meta";
import { authenticateApiKey, type AuthenticatedApiKey } from "./api-keys";
import type { V1JsonResult } from "./v1-handlers";

const AUTH_ERROR_MESSAGE = {
  INVALID_KEY: "Clé API manquante ou invalide (attendu : Authorization: Bearer <clé>).",
  REVOKED_KEY: "Cette clé API a été révoquée.",
  COMPANY_SUSPENDED: "L'entreprise associée à cette clé API est suspendue.",
} as const;

export async function requireV1ApiKey(
  req: Request,
): Promise<{ ok: true; apiKey: AuthenticatedApiKey } | { ok: false; response: NextResponse }> {
  const auth = await authenticateApiKey(db, req.headers.get("authorization"));
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: auth.error,
            message: AUTH_ERROR_MESSAGE[auth.error],
          },
        },
        {
          status: auth.error === "COMPANY_SUSPENDED" ? 403 : 401,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    };
  }
  return { ok: true, apiKey: auth.apiKey };
}

export async function readJsonBody(
  req: Request,
): Promise<
  | { ok: true; body: Record<string, unknown>; rawBody: string }
  | { ok: false; response: NextResponse }
> {
  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return { ok: true, body: {}, rawBody: "" };
  }
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: {
              code: "INVALID_JSON",
              message: "Le corps de la requête doit être un objet JSON.",
            },
          },
          { status: 400 },
        ),
      };
    }
    return { ok: true, body: parsed as Record<string, unknown>, rawBody };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Corps JSON invalide.",
          },
        },
        { status: 400 },
      ),
    };
  }
}

export async function readV1RequestContext(req: Request) {
  const meta = await getRequestMeta();
  return {
    idempotencyKey: req.headers.get("idempotency-key"),
    meta: { ip: meta.ip, userAgent: meta.userAgent },
  };
}

export function jsonV1Response(result: V1JsonResult): NextResponse {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.replayed) {
    headers["X-Idempotency-Replayed"] = "true";
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}
