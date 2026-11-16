import { and, asc, eq } from "drizzle-orm";
import { companies, companyCouriers, couriers } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { computeDeviceFingerprint, hashSecret, verifySecret } from "@/lib/security";
import { normalizePhone } from "@/lib/validation";
import { createSession, findValidSession, revokeSession, type SessionMeta } from "./sessions";

// Connexion du livreur à sa PWA : téléphone + PIN à 6 chiffres (tâche 2.3).
// Blocage stocké EN BASE (couriers.pin_failed_attempts / pin_locked_until) :
// il résiste à un redémarrage du serveur, contrairement au frein en mémoire.

export const COURIER_SESSION_TTL_MS = 14 * 24 * 60 * 60_000; // 14 jours
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MS = 15 * 60_000;

export type CourierIdentity = {
  id: string;
  name: string;
  phone: string;
  /** Empreinte de l'appareil enregistrée à la connexion (tâche 2.4). */
  deviceFingerprint: string | null;
  /** Entreprises où il est rattaché et actif (sa PWA regroupe les colis par entreprise). */
  companies: { id: string; name: string }[];
};

export type CourierLoginResult =
  | { ok: true; token: string; expiresAt: Date; courier: CourierIdentity }
  | { ok: false; error: "INVALID" | "LOCKED"; lockedUntil?: Date };

let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashSecret("000000-ofika-dummy");
  return dummyHash;
}

async function activeCompanies(db: Executor, courierId: string) {
  // Règle 3 : un seul compte livreur ; chaque entreprise reste cloisonnée côté entreprise.
  // tenant-guard: livreur — on lit SES rattachements actifs (filtre courierId), pas les données d'une entreprise
  return db.select({ id: companies.id, name: companies.name })
    .from(companyCouriers)
    .innerJoin(companies, eq(companies.id, companyCouriers.companyId))
    .where(and(eq(companyCouriers.courierId, courierId), eq(companyCouriers.isActive, true), eq(companies.status, "ACTIVE")))
    .orderBy(asc(companies.name));
}

export async function loginCourier(db: Executor, phoneInput: string, pin: string, meta: SessionMeta = {}): Promise<CourierLoginResult> {
  const phone = normalizePhone(phoneInput);

  return db.transaction(async (tx) => {
    const [courier] = phone
      ? await tx.select().from(couriers).where(eq(couriers.phone, phone)).limit(1).for("update")
      : [];
    const now = new Date();

    if (courier?.pinLockedUntil && courier.pinLockedUntil > now) {
      await logEvent(tx, { eventType: "COURIER_LOGIN_LOCKED", actorType: "COURIER", actorId: courier.id, ip: meta.ip, userAgent: meta.userAgent });
      return { ok: false, error: "LOCKED", lockedUntil: courier.pinLockedUntil };
    }

    // Toujours un calcul scrypt : même durée, numéro inconnu ou PIN faux
    const pinOk = /^\d{6}$/.test(pin) && (await verifySecret(pin, courier?.pinHash ?? (await getDummyHash())));

    if (!courier || !courier.isActive || !courier.pinHash || !pinOk) {
      if (courier) {
        const failures = courier.pinFailedAttempts + 1;
        const lock = failures >= PIN_MAX_FAILURES;
        await tx
          .update(couriers)
          .set(lock ? { pinFailedAttempts: 0, pinLockedUntil: new Date(now.getTime() + PIN_LOCK_MS) } : { pinFailedAttempts: failures })
          .where(eq(couriers.id, courier.id));
        await logEvent(tx, {
          eventType: lock ? "COURIER_PIN_LOCKED" : "COURIER_LOGIN_FAILED",
          actorType: "COURIER",
          actorId: courier.id,
          payload: { failures, reason: !courier.isActive ? "inactive" : !courier.pinHash ? "no_pin" : "bad_pin" },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
      return { ok: false, error: "INVALID" };
    }

    await tx.update(couriers).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(couriers.id, courier.id));
    const deviceFingerprint = meta.deviceFingerprint?.trim() || computeDeviceFingerprint({ userAgent: meta.userAgent });
    const session = await createSession(tx, { kind: "courier", id: courier.id }, COURIER_SESSION_TTL_MS, {
      ...meta,
      deviceFingerprint,
    });
    await logEvent(tx, {
      eventType: "COURIER_LOGIN",
      actorType: "COURIER",
      actorId: courier.id,
      payload: { sessionId: session.sessionId, deviceFingerprint },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      courier: {
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        deviceFingerprint,
        companies: await activeCompanies(tx, courier.id),
      },
    };
  });
}

/** Livreur actif correspondant au jeton, avec ses entreprises actuelles ; sinon null. */
export async function getCourierBySession(db: Executor, token: string | undefined | null): Promise<CourierIdentity | null> {
  const session = await findValidSession(db, token);
  if (!session?.courierId) return null;
  const [courier] = await db.select().from(couriers).where(eq(couriers.id, session.courierId)).limit(1);
  if (!courier?.isActive || !courier.pinHash) return null;
  return {
    id: courier.id,
    name: courier.name,
    phone: courier.phone,
    deviceFingerprint: session.deviceFingerprint,
    companies: await activeCompanies(db, courier.id),
  };
}

export async function logoutCourier(db: Executor, token: string | undefined | null, meta: SessionMeta = {}) {
  const courier = await getCourierBySession(db, token);
  await revokeSession(db, token);
  if (courier) {
    await logEvent(db, { eventType: "COURIER_LOGOUT", actorType: "COURIER", actorId: courier.id, ip: meta.ip, userAgent: meta.userAgent });
  }
}
