import { eq } from "drizzle-orm";
import { companies, userRoles, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { hashSecret, verifySecret } from "@/lib/security";
import { isLocked, recordFailure, recordSuccess } from "./login-throttle";
import { normalizeEmail } from "./platform-admin";
import { createSession, findValidSession, revokeSession, type SessionMeta } from "./sessions";

// Connexion des utilisateurs d'entreprise (admin entreprise, gestionnaire,
// responsable retours). Sans Next.js : testable seule.

export const USER_SESSION_TTL_MS = 7 * 24 * 60 * 60_000; // 7 jours

export type UserRole = "COMPANY_ADMIN" | "MANAGER" | "RETURNS_OFFICER";

export type CompanyUserIdentity = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  roles: UserRole[];
};

export type UserLoginResult =
  | { ok: true; token: string; expiresAt: Date; user: CompanyUserIdentity }
  | { ok: false; error: "INVALID" | "LOCKED" | "COMPANY_SUSPENDED" };

let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashSecret("ofika-dummy-password-for-timing");
  return dummyHash;
}

async function loadIdentity(db: Executor, userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      activatedAt: users.activatedAt,
      companyId: companies.id,
      companyName: companies.name,
      companyStatus: companies.status,
    })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const roles = (await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId))).map(
    (r) => r.role,
  );
  return { ...row, roles };
}

function toIdentity(row: NonNullable<Awaited<ReturnType<typeof loadIdentity>>>): CompanyUserIdentity {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    companyId: row.companyId,
    companyName: row.companyName,
    roles: row.roles,
  };
}

export async function loginCompanyUser(
  db: Executor,
  emailInput: string,
  password: string,
  meta: SessionMeta = {},
): Promise<UserLoginResult> {
  const email = normalizeEmail(emailInput);
  const throttleKey = `company-user:${email}`;

  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  const row = found ? await loadIdentity(db, found.id) : null;

  if (isLocked(throttleKey)) {
    await logEvent(db, {
      companyId: row?.companyId ?? null,
      eventType: "USER_LOGIN_LOCKED",
      actorType: "USER",
      actorId: row?.id ?? null,
      payload: { email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, error: "LOCKED" };
  }

  // Toujours un calcul scrypt, même sans compte : même durée de réponse
  const passwordOk = await verifySecret(password, row?.passwordHash ?? (await getDummyHash()));

  const reason = !row
    ? "unknown_email"
    : !row.activatedAt || !row.passwordHash
      ? "not_activated"
      : !row.isActive
        ? "inactive"
        : !passwordOk
          ? "bad_password"
          : null;

  if (reason || !row) {
    recordFailure(throttleKey);
    await logEvent(db, {
      companyId: row?.companyId ?? null,
      eventType: "USER_LOGIN_FAILED",
      actorType: "USER",
      actorId: row?.id ?? null,
      payload: { email, reason },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, error: "INVALID" };
  }

  // Mot de passe juste mais entreprise suspendue : on le dit (l'utilisateur
  // a prouvé qui il est, l'information ne profite pas à un attaquant).
  if (row.companyStatus !== "ACTIVE") {
    await logEvent(db, {
      companyId: row.companyId,
      eventType: "USER_LOGIN_REFUSED_SUSPENDED",
      actorType: "USER",
      actorId: row.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, error: "COMPANY_SUSPENDED" };
  }

  recordSuccess(throttleKey);
  const session = await createSession(db, { kind: "user", id: row.id }, USER_SESSION_TTL_MS, meta);
  await logEvent(db, {
    companyId: row.companyId,
    eventType: "USER_LOGIN",
    actorType: "USER",
    actorId: row.id,
    payload: { sessionId: session.sessionId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { ok: true, token: session.token, expiresAt: session.expiresAt, user: toIdentity(row) };
}

/**
 * Utilisateur correspondant au jeton, ou null. Revérifie à chaque requête :
 * compte actif et activé, entreprise active. Une suspension coupe donc
 * immédiatement l'accès, sans attendre l'expiration des sessions.
 */
export async function getCompanyUserBySession(db: Executor, token: string | undefined | null) {
  const session = await findValidSession(db, token);
  if (!session?.userId) return null;
  const row = await loadIdentity(db, session.userId);
  if (!row || !row.isActive || !row.activatedAt || row.companyStatus !== "ACTIVE") return null;
  return toIdentity(row);
}

export async function logoutCompanyUser(db: Executor, token: string | undefined | null, meta: SessionMeta = {}) {
  const user = await getCompanyUserBySession(db, token);
  await revokeSession(db, token);
  if (user) {
    await logEvent(db, {
      companyId: user.companyId,
      eventType: "USER_LOGOUT",
      actorType: "USER",
      actorId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
