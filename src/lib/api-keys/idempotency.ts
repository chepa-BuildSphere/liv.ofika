import { eq } from "drizzle-orm";
import { idempotencyKeys } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { hashToken } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import type { AuthenticatedApiKey } from "./api-keys";

const MAX_IDEMPOTENCY_KEY_LEN = 255;

export type IdempotentResponse = {
  status: number;
  body: Record<string, unknown>;
  replayed: boolean;
};

/** Empreinte SHA-256 déterministe de la requête (`METHOD + PATH + BODY`). */
export function computeIdempotencyRequestHash(
  method: string,
  path: string,
  rawBody: string,
): string {
  return hashToken(`${method.toUpperCase()}\n${path}\n${rawBody}`);
}

/**
 * Exécute un `POST` idempotent : si l'en-tête `Idempotency-Key` a déjà été reçu
 * pour la même entreprise et le même environnement (`TEST` / `LIVE`) avec la même
 * empreinte de requête, renvoie la réponse enregistrée sans ré-exécuter l'action.
 */
export async function runIdempotentPost(
  db: Executor,
  apiKey: AuthenticatedApiKey,
  idempotencyKey: string | null | undefined,
  requestHash: string,
  execute: (tx: Executor) => Promise<{ status: number; body: Record<string, unknown> }>,
): Promise<IdempotentResponse> {
  const cleanKey = idempotencyKey?.trim() ?? "";
  if (!cleanKey) {
    const res = await execute(db);
    return { ...res, replayed: false };
  }

  if (cleanKey.length > MAX_IDEMPOTENCY_KEY_LEN) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message: `L'en-tête Idempotency-Key ne doit pas dépasser ${MAX_IDEMPOTENCY_KEY_LEN} caractères.`,
        },
      },
      replayed: false,
    };
  }

  return db.transaction(async (tx) => {
    const [existing] = await tenantScope(tx, apiKey.companyId).selectAll(
      idempotencyKeys,
      eq(idempotencyKeys.environment, apiKey.environment),
      eq(idempotencyKeys.key, cleanKey),
    );

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return {
          status: 409,
          body: {
            error: {
              code: "IDEMPOTENCY_KEY_CONFLICT",
              message:
                "Cette clé Idempotency-Key a déjà été utilisée avec une requête différente.",
            },
          },
          replayed: false,
        };
      }

      return {
        status: existing.responseStatus,
        body: (existing.responseBody as Record<string, unknown>) ?? {},
        replayed: true,
      };
    }

    const res = await execute(tx);
    if (res.status < 500) {
      await tenantScope(tx, apiKey.companyId).insert(idempotencyKeys, {
        environment: apiKey.environment,
        key: cleanKey,
        requestHash,
        responseStatus: res.status,
        responseBody: res.body,
      });
    }

    return { ...res, replayed: false };
  });
}
