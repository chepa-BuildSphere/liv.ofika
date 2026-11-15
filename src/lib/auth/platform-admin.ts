import { eq } from "drizzle-orm";
import { platformAdmins } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { hashSecret, verifySecret } from "@/lib/security";
import { isLocked, recordFailure, recordSuccess } from "./login-throttle";
import { createSession, findValidSession, revokeSession, type SessionMeta } from "./sessions";

// Logique de l'admin plateforme, sans Next.js (testable seule).

export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60_000; // 12 h

export type AdminIdentity = { id: string; email: string; name: string };

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; admin: AdminIdentity }
  | { ok: false; error: "INVALID" | "LOCKED" };

// Hash factice : vérifié quand l'e-mail n'existe pas, pour que la réponse prenne
// le même temps et ne révèle pas quels e-mails ont un compte.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashSecret("ofika-dummy-password-for-timing");
  return dummyHash;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function loginPlatformAdmin(
  db: Executor,
  emailInput: string,
  password: string,
  meta: SessionMeta = {},
): Promise<LoginResult> {
  const email = normalizeEmail(emailInput);
  const throttleKey = `platform-admin:${email}`;

  if (isLocked(throttleKey)) {
    await logEvent(db, {
      eventType: "PLATFORM_ADMIN_LOGIN_LOCKED",
      actorType: "PLATFORM_ADMIN",
      payload: { email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, error: "LOCKED" };
  }

  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, email)).limit(1);
  const passwordOk = await verifySecret(password, admin?.passwordHash ?? (await getDummyHash()));

  if (!admin || !admin.isActive || !passwordOk) {
    recordFailure(throttleKey);
    await logEvent(db, {
      eventType: "PLATFORM_ADMIN_LOGIN_FAILED",
      actorType: "PLATFORM_ADMIN",
      actorId: admin?.id ?? null,
      payload: { email, reason: !admin ? "unknown_email" : !admin.isActive ? "inactive" : "bad_password" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, error: "INVALID" };
  }

  recordSuccess(throttleKey);
  const session = await createSession(db, { kind: "platformAdmin", id: admin.id }, ADMIN_SESSION_TTL_MS, meta);
  await logEvent(db, {
    eventType: "PLATFORM_ADMIN_LOGIN",
    actorType: "PLATFORM_ADMIN",
    actorId: admin.id,
    payload: { sessionId: session.sessionId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    admin: { id: admin.id, email: admin.email, name: admin.name },
  };
}

/** Admin actif correspondant au jeton de session, ou null. */
export async function getPlatformAdminBySession(db: Executor, token: string | undefined | null) {
  const session = await findValidSession(db, token);
  if (!session?.platformAdminId) return null;
  const [admin] = await db
    .select({ id: platformAdmins.id, email: platformAdmins.email, name: platformAdmins.name, isActive: platformAdmins.isActive })
    .from(platformAdmins)
    .where(eq(platformAdmins.id, session.platformAdminId))
    .limit(1);
  if (!admin?.isActive) return null;
  return { id: admin.id, email: admin.email, name: admin.name } satisfies AdminIdentity;
}

export async function logoutPlatformAdmin(db: Executor, token: string | undefined | null, meta: SessionMeta = {}) {
  const admin = await getPlatformAdminBySession(db, token);
  await revokeSession(db, token);
  if (admin) {
    await logEvent(db, {
      eventType: "PLATFORM_ADMIN_LOGOUT",
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

export async function createPlatformAdmin(db: Executor, input: { email: string; name: string; password: string }) {
  if (input.password.length < 12) throw new Error("Le mot de passe doit faire au moins 12 caractères");
  const [admin] = await db
    .insert(platformAdmins)
    .values({ email: normalizeEmail(input.email), name: input.name.trim(), passwordHash: await hashSecret(input.password) })
    .returning({ id: platformAdmins.id, email: platformAdmins.email, name: platformAdmins.name });
  await logEvent(db, {
    eventType: "PLATFORM_ADMIN_CREATED",
    actorType: "SYSTEM",
    payload: { platformAdminId: admin.id, email: admin.email },
  });
  return admin;
}
