import { and, eq, isNull } from "drizzle-orm";
import { companies, userAccessTokens, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { hashSecret, hashToken, randomToken } from "@/lib/security";

// Lien d'activation : l'utilisateur choisit lui-même son premier mot de passe.
// Usage unique, 48 h, remplacé (révoqué) si un nouveau lien est généré.

export const ACTIVATION_TTL_MS = 48 * 60 * 60_000;
export const MIN_PASSWORD_LENGTH = 10;

export type IssuedBy = { platformAdminId: string } | { userId: string };

/** Nouveau lien pour cet utilisateur ; les liens précédents non utilisés sont révoqués. */
export async function issueActivationToken(db: Executor, userId: string, issuedBy: IssuedBy) {
  const now = new Date();
  await db
    .update(userAccessTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(userAccessTokens.userId, userId),
        eq(userAccessTokens.purpose, "ACTIVATION"),
        isNull(userAccessTokens.usedAt),
        isNull(userAccessTokens.revokedAt),
      ),
    );

  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + ACTIVATION_TTL_MS);
  await db.insert(userAccessTokens).values({
    userId,
    purpose: "ACTIVATION",
    tokenHash: hashToken(token),
    expiresAt,
    createdByPlatformAdminId: "platformAdminId" in issuedBy ? issuedBy.platformAdminId : null,
    createdByUserId: "userId" in issuedBy ? issuedBy.userId : null,
  });
  return { token, expiresAt };
}

export type ActivationProblem = "INVALID" | "EXPIRED" | "USED" | "ALREADY_ACTIVE";

type Lookup =
  | { ok: true; tokenId: string; user: { id: string; name: string; email: string }; companyName: string }
  | { ok: false; problem: ActivationProblem };

async function lookup(db: Executor, token: string, forUpdate: boolean): Promise<Lookup> {
  if (!token) return { ok: false, problem: "INVALID" };
  const query = db
    .select({
      tokenId: userAccessTokens.id,
      expiresAt: userAccessTokens.expiresAt,
      usedAt: userAccessTokens.usedAt,
      revokedAt: userAccessTokens.revokedAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      activatedAt: users.activatedAt,
      companyName: companies.name,
    })
    .from(userAccessTokens)
    .innerJoin(users, eq(users.id, userAccessTokens.userId))
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(and(eq(userAccessTokens.tokenHash, hashToken(token)), eq(userAccessTokens.purpose, "ACTIVATION")))
    .limit(1);
  const [row] = forUpdate ? await query.for("update", { of: userAccessTokens }) : await query;

  if (!row || row.revokedAt || !row.isActive) return { ok: false, problem: "INVALID" };
  if (row.usedAt) return { ok: false, problem: "USED" };
  if (row.activatedAt) return { ok: false, problem: "ALREADY_ACTIVE" };
  if (row.expiresAt <= new Date()) return { ok: false, problem: "EXPIRED" };
  return {
    ok: true,
    tokenId: row.tokenId,
    user: { id: row.userId, name: row.name, email: row.email },
    companyName: row.companyName,
  };
}

/** Pour afficher la page d'activation (qui, quelle entreprise), sans rien modifier. */
export async function findActivation(db: Executor, token: string) {
  const r = await lookup(db, token, false);
  return r.ok ? { ok: true as const, user: r.user, companyName: r.companyName } : r;
}

export type ActivationResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; problem: ActivationProblem | "WEAK_PASSWORD" | "MISMATCH" };

export async function activateAccount(
  db: Executor,
  token: string,
  password: string,
  confirmation: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<ActivationResult> {
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, problem: "WEAK_PASSWORD" };
  if (password !== confirmation) return { ok: false, problem: "MISMATCH" };

  return db.transaction(async (tx) => {
    // FOR UPDATE : deux clics simultanés sur le même lien → un seul passe
    const found = await lookup(tx, token, true);
    if (!found.ok) return found;

    const now = new Date();
    await tx
      .update(users)
      .set({ passwordHash: await hashSecret(password), activatedAt: now })
      .where(eq(users.id, found.user.id));
    await tx.update(userAccessTokens).set({ usedAt: now }).where(eq(userAccessTokens.id, found.tokenId));

    const [{ companyId }] = await tx
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, found.user.id));
    await logEvent(tx, {
      companyId,
      eventType: "USER_ACTIVATED",
      actorType: "USER",
      actorId: found.user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: true, userId: found.user.id, email: found.user.email };
  });
}
