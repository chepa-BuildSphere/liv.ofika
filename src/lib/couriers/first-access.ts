import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { companyCouriers, courierAccessCodes, couriers } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { isLocked, recordFailure, recordSuccess } from "@/lib/auth/login-throttle";
import { can, userActor } from "@/lib/auth/permissions";
import { hashCode, hashSecret, randomDigits, verifyCode } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import { normalizePhone } from "@/lib/validation";

// Premier accès du livreur (tâche 2.2, option « code d'accès ») :
//   1. l'entreprise génère un code à 6 chiffres (48 h, usage unique) et le donne au livreur ;
//   2. le livreur saisit téléphone + code + son PIN à 6 chiffres sur son téléphone.
// Le code n'est généré QUE si le livreur n'a pas encore de PIN : une fois le PIN
// choisi, aucune entreprise ne peut prendre la main sur son compte.

export const ACCESS_CODE_TTL_MS = 48 * 60 * 60_000;
export const ACCESS_CODE_MAX_FAILURES = 5;

const codeContext = (courierId: string) => `courier-access:${courierId}`;

export class FirstAccessError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "PIN_ALREADY_SET" | "INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "FirstAccessError";
  }
}

// ─── Règles du PIN ────────────────────────────────────────────────────────────

export type PinProblem = "FORMAT" | "WEAK" | "MISMATCH";

/** PIN trop facile à deviner : chiffres identiques, suites, motifs répétés. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 000000, 777777
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return true; // 123456, 654321
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return true; // 121212, 123123
  return false;
}

export function checkPin(pin: string, confirmation: string): PinProblem | null {
  if (!/^\d{6}$/.test(pin)) return "FORMAT";
  if (isWeakPin(pin)) return "WEAK";
  if (pin !== confirmation) return "MISMATCH";
  return null;
}

// ─── Côté entreprise : générer le code ────────────────────────────────────────

export async function issueAccessCode(db: Executor, actor: CompanyUserIdentity, courierId: string, key: Buffer) {
  if (!can(userActor(actor), "couriers.manage", { companyId: actor.companyId }).allowed) {
    throw new FirstAccessError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
  }

  return db.transaction(async (tx) => {
    // Le livreur doit être rattaché (et actif) à l'entreprise de l'acteur
    const [link] = await tenantScope(tx, actor.companyId).selectAll(
      companyCouriers,
      eq(companyCouriers.courierId, courierId),
      eq(companyCouriers.isActive, true),
    );
    if (!link) throw new FirstAccessError("NOT_FOUND", "Livreur introuvable.");

    const [courier] = await tx.select().from(couriers).where(eq(couriers.id, courierId)).limit(1).for("update");
    if (!courier?.isActive) throw new FirstAccessError("INACTIVE", "Ce compte livreur est désactivé.");
    if (courier.pinHash) {
      throw new FirstAccessError("PIN_ALREADY_SET", "Ce livreur a déjà choisi son code PIN : il se connecte directement.");
    }

    const now = new Date();
    await tx
      .update(courierAccessCodes)
      .set({ revokedAt: now })
      .where(and(eq(courierAccessCodes.courierId, courierId), isNull(courierAccessCodes.usedAt), isNull(courierAccessCodes.revokedAt)));

    const code = randomDigits(6);
    const expiresAt = new Date(now.getTime() + ACCESS_CODE_TTL_MS);
    await tx.insert(courierAccessCodes).values({
      courierId,
      codeHash: hashCode(code, codeContext(courierId), key),
      expiresAt,
      issuedByCompanyId: actor.companyId,
      issuedByUserId: actor.id,
    });
    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "COURIER_ACCESS_CODE_ISSUED",
      actorType: "USER",
      actorId: actor.id,
      payload: { courierId },
    });
    return { code, expiresAt, courierName: courier.name, phone: courier.phone };
  });
}

// ─── Côté livreur : premier accès ─────────────────────────────────────────────

export type FirstAccessResult =
  | { ok: true; courierId: string }
  | { ok: false; problem: "INVALID" | "LOCKED" | PinProblem };

export async function completeFirstAccess(
  db: Executor,
  input: { phone: string; code: string; pin: string; pinConfirmation: string },
  key: Buffer,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<FirstAccessResult> {
  const pinProblem = checkPin(input.pin, input.pinConfirmation);
  if (pinProblem) return { ok: false, problem: pinProblem };

  const phone = normalizePhone(input.phone);
  const code = input.code.replace(/\s/g, "");
  if (!phone || !/^\d{6}$/.test(code)) return { ok: false, problem: "INVALID" };

  const throttleKey = `courier-first-access:${phone}`;
  if (isLocked(throttleKey)) return { ok: false, problem: "LOCKED" };

  const result = await db.transaction(async (tx): Promise<FirstAccessResult & { companyId?: string }> => {
    const [courier] = await tx.select().from(couriers).where(eq(couriers.phone, phone)).limit(1).for("update");
    if (!courier || !courier.isActive || courier.pinHash) return { ok: false, problem: "INVALID" };

    const [active] = await tx
      .select()
      .from(courierAccessCodes)
      .where(
        and(
          eq(courierAccessCodes.courierId, courier.id),
          isNull(courierAccessCodes.usedAt),
          isNull(courierAccessCodes.revokedAt),
          gt(courierAccessCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(courierAccessCodes.createdAt))
      .limit(1)
      .for("update");
    if (!active) return { ok: false, problem: "INVALID" };

    if (!verifyCode(code, codeContext(courier.id), active.codeHash, key)) {
      const failures = active.failedAttempts + 1;
      const lock = failures >= ACCESS_CODE_MAX_FAILURES;
      await tx
        .update(courierAccessCodes)
        .set({ failedAttempts: failures, ...(lock ? { revokedAt: new Date() } : {}) })
        .where(eq(courierAccessCodes.id, active.id));
      await logEvent(tx, {
        companyId: active.issuedByCompanyId,
        eventType: lock ? "COURIER_ACCESS_CODE_LOCKED" : "COURIER_ACCESS_CODE_FAILED",
        actorType: "COURIER",
        actorId: courier.id,
        payload: { failures },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return { ok: false, problem: "INVALID" };
    }

    const now = new Date();
    await tx
      .update(couriers)
      .set({ pinHash: await hashSecret(input.pin), pinSetAt: now, pinFailedAttempts: 0, pinLockedUntil: null })
      .where(eq(couriers.id, courier.id));
    await tx.update(courierAccessCodes).set({ usedAt: now }).where(eq(courierAccessCodes.id, active.id));
    await logEvent(tx, {
      companyId: active.issuedByCompanyId,
      eventType: "COURIER_PIN_SET",
      actorType: "COURIER",
      actorId: courier.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: true, courierId: courier.id };
  });

  if (result.ok) recordSuccess(throttleKey);
  else if (result.problem === "INVALID") recordFailure(throttleKey);
  return result.ok ? { ok: true, courierId: result.courierId } : result;
}
