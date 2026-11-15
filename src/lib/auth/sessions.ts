import { and, eq, gt, isNull } from "drizzle-orm";
import type { Executor } from "@/lib/audit";
import { sessions } from "@/db/schema";
import { hashToken, randomToken } from "@/lib/security";

// Sessions en base (table `sessions`). Le cookie contient un jeton aléatoire de
// 256 bits ; la base n'en garde que l'empreinte. Une session se révoque
// instantanément (déconnexion, compte désactivé), ce qu'un cookie signé seul
// ne permet pas.

export type SessionOwner =
  | { kind: "platformAdmin"; id: string }
  | { kind: "user"; id: string }
  | { kind: "courier"; id: string };

export type SessionMeta = { ip?: string | null; userAgent?: string | null; deviceFingerprint?: string | null };

export async function createSession(db: Executor, owner: SessionOwner, ttlMs: number, meta: SessionMeta = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlMs);
  const [row] = await db
    .insert(sessions)
    .values({
      tokenHash: hashToken(token),
      platformAdminId: owner.kind === "platformAdmin" ? owner.id : null,
      userId: owner.kind === "user" ? owner.id : null,
      courierId: owner.kind === "courier" ? owner.id : null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      deviceFingerprint: meta.deviceFingerprint ?? null,
      expiresAt,
    })
    .returning({ id: sessions.id });
  return { token, sessionId: row.id, expiresAt };
}

/** Session valide (ni expirée, ni révoquée) correspondant au jeton, ou null. */
export async function findValidSession(db: Executor, token: string | undefined | null) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function revokeSession(db: Executor, token: string | undefined | null) {
  if (!token) return;
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)));
}
