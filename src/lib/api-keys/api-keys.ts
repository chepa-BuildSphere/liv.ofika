import { desc, eq } from "drizzle-orm";
import { apiKeys, companies, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, userActor } from "@/lib/auth/permissions";
import { apiKeyEnvironment, generateApiKey, hashToken, type ApiKeyEnvironment } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";

export type ApiKeyErrorCode = "FORBIDDEN" | "INVALID" | "NOT_FOUND";

export type ApiKeyField = "name" | "environment";

export class ApiKeyError extends Error {
  constructor(
    readonly code: ApiKeyErrorCode,
    message: string,
    readonly fields?: Partial<Record<ApiKeyField, string>>,
  ) {
    super(message);
    this.name = "ApiKeyError";
  }
}

export type CreateApiKeyInput = {
  name: string;
  environment: string;
};

export type ValidatedCreateApiKeyInput = {
  name: string;
  environment: ApiKeyEnvironment;
};

export type CreateApiKeyValidationResult =
  | { ok: true; data: ValidatedCreateApiKeyInput }
  | { ok: false; fields: Partial<Record<ApiKeyField, string>> };

export type PublicApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  environment: ApiKeyEnvironment;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  createdByName: string;
};

export type RevokedApiKeyItem = Omit<PublicApiKeyItem, "createdByName">;

export type AuthenticatedApiKey = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  prefix: string;
  environment: ApiKeyEnvironment;
  isTest: boolean;
  livemode: boolean;
};

export type AuthenticateApiKeyResult =
  | { ok: true; apiKey: AuthenticatedApiKey }
  | { ok: false; error: "INVALID_KEY" | "REVOKED_KEY" | "COMPANY_SUSPENDED" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_NAME_LEN = 2;
const MAX_NAME_LEN = 80;

/** Valide les champs de création d'une clé API (nom et environnement TEST / LIVE). */
export function validateCreateApiKeyInput(raw: CreateApiKeyInput): CreateApiKeyValidationResult {
  const fields: Partial<Record<ApiKeyField, string>> = {};

  const name = raw.name?.trim() ?? "";
  if (name.length < MIN_NAME_LEN || name.length > MAX_NAME_LEN) {
    fields.name = `Le nom doit contenir entre ${MIN_NAME_LEN} et ${MAX_NAME_LEN} caractères.`;
  }

  const env = raw.environment?.trim();
  const validEnv = env === "TEST" || env === "LIVE" ? env : null;
  if (!validEnv) {
    fields.environment = "Choisissez l'environnement Test ou Production.";
  }

  if (Object.keys(fields).length > 0 || !validEnv) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    data: {
      name,
      environment: validEnv,
    },
  };
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer <clé>`. */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function assertCanManageApiKeys(actor: CompanyUserIdentity) {
  if (!can(userActor(actor), "apiKeys.manage", { companyId: actor.companyId }).allowed) {
    throw new ApiKeyError(
      "FORBIDDEN",
      "La gestion des clés API est réservée à l'admin entreprise.",
    );
  }
}

/** Crée une clé API `TEST` ou `LIVE` et ne retourne la clé complète qu'une seule fois. */
export async function createApiKey(
  db: Executor,
  actor: CompanyUserIdentity,
  input: CreateApiKeyInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ apiKey: PublicApiKeyItem; secretKey: string }> {
  assertCanManageApiKeys(actor);

  const checked = validateCreateApiKeyInput(input);
  if (!checked.ok) {
    const firstMsg = Object.values(checked.fields)[0] ?? "Formulaire incomplet.";
    throw new ApiKeyError("INVALID", firstMsg, checked.fields);
  }

  const generated = generateApiKey(checked.data.environment);

  return db.transaction(async (tx) => {
    const [inserted] = await tenantScope(tx, actor.companyId).insert(apiKeys, {
      name: checked.data.name,
      prefix: generated.prefix,
      keyHash: generated.hash,
      environment: checked.data.environment,
      createdByUserId: actor.id,
    });

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "API_KEY_CREATED",
      actorType: "USER",
      actorId: actor.id,
      payload: {
        apiKeyId: inserted.id,
        name: inserted.name,
        prefix: inserted.prefix,
        environment: inserted.environment,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return {
      apiKey: {
        id: inserted.id,
        name: inserted.name,
        prefix: inserted.prefix,
        environment: inserted.environment,
        lastUsedAt: inserted.lastUsedAt,
        revokedAt: inserted.revokedAt,
        createdAt: inserted.createdAt,
        createdByName: actor.name,
      },
      secretKey: generated.key,
    };
  });
}

/** Liste les clés API de l'entreprise sans jamais exposer `keyHash` ni la clé complète. */
export async function listApiKeys(
  db: Executor,
  actor: CompanyUserIdentity,
): Promise<PublicApiKeyItem[]> {
  assertCanManageApiKeys(actor);

  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      environment: apiKeys.environment,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
      createdByName: users.name,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.createdByUserId, users.id))
    .where(tenantScope(db, actor.companyId).filter(apiKeys, eq(users.companyId, actor.companyId)))
    .orderBy(desc(apiKeys.createdAt));
}

/** Révoque immédiatement une clé API appartenant à l'entreprise. */
export async function revokeApiKey(
  db: Executor,
  actor: CompanyUserIdentity,
  apiKeyId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ apiKey: RevokedApiKeyItem; alreadyRevoked: boolean }> {
  assertCanManageApiKeys(actor);

  if (!UUID_RE.test(apiKeyId)) {
    throw new ApiKeyError("NOT_FOUND", "Clé API introuvable.");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tenantScope(tx, actor.companyId).selectAll(
      apiKeys,
      eq(apiKeys.id, apiKeyId),
    );
    if (!existing) {
      throw new ApiKeyError("NOT_FOUND", "Clé API introuvable.");
    }

    if (existing.revokedAt !== null) {
      return {
        apiKey: {
          id: existing.id,
          name: existing.name,
          prefix: existing.prefix,
          environment: existing.environment,
          lastUsedAt: existing.lastUsedAt,
          revokedAt: existing.revokedAt,
          createdAt: existing.createdAt,
        },
        alreadyRevoked: true,
      };
    }

    const [updated] = await tenantScope(tx, actor.companyId).update(
      apiKeys,
      { revokedAt: new Date() },
      eq(apiKeys.id, existing.id),
    );

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "API_KEY_REVOKED",
      actorType: "USER",
      actorId: actor.id,
      payload: {
        apiKeyId: updated.id,
        name: updated.name,
        prefix: updated.prefix,
        environment: updated.environment,
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return {
      apiKey: {
        id: updated.id,
        name: updated.name,
        prefix: updated.prefix,
        environment: updated.environment,
        lastUsedAt: updated.lastUsedAt,
        revokedAt: updated.revokedAt,
        createdAt: updated.createdAt,
      },
      alreadyRevoked: false,
    };
  });
}

/**
 * Authentifie une requête par clé API (`ofk_test_…` ou `ofk_live_…`)
 * ou en-tête `Authorization: Bearer <clé>`. Refuse les clés révoquées ou
 * appartenant à une entreprise suspendue.
 */
export async function authenticateApiKey(
  db: Executor,
  tokenOrHeader: string | null | undefined,
): Promise<AuthenticateApiKeyResult> {
  if (!tokenOrHeader) {
    return { ok: false, error: "INVALID_KEY" };
  }

  const trimmed = tokenOrHeader.trim();
  const rawKey = /^bearer\s+/i.test(trimmed)
    ? extractBearerToken(trimmed)
    : /\s/.test(trimmed)
      ? null
      : trimmed;

  if (!rawKey) {
    return { ok: false, error: "INVALID_KEY" };
  }

  const env = apiKeyEnvironment(rawKey);
  if (!env) {
    return { ok: false, error: "INVALID_KEY" };
  }

  const keyHash = hashToken(rawKey);

  const [row] = await db
    .select({
      id: apiKeys.id,
      companyId: apiKeys.companyId,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      environment: apiKeys.environment,
      revokedAt: apiKeys.revokedAt,
      companyName: companies.name,
      companyStatus: companies.status,
    })
    // tenant-guard: authentification par hash de clé API avant résolution de company_id
    .from(apiKeys)
    .innerJoin(companies, eq(apiKeys.companyId, companies.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row || row.environment !== env) {
    return { ok: false, error: "INVALID_KEY" };
  }
  if (row.revokedAt !== null) {
    return { ok: false, error: "REVOKED_KEY" };
  }
  if (row.companyStatus !== "ACTIVE") {
    return { ok: false, error: "COMPANY_SUSPENDED" };
  }

  await tenantScope(db, row.companyId).update(
    apiKeys,
    { lastUsedAt: new Date() },
    eq(apiKeys.id, row.id),
  );

  return {
    ok: true,
    apiKey: {
      id: row.id,
      companyId: row.companyId,
      companyName: row.companyName,
      name: row.name,
      prefix: row.prefix,
      environment: row.environment,
      isTest: row.environment === "TEST",
      livemode: row.environment === "LIVE",
    },
  };
}
