// Auth admin plateforme sur la base `dev`, dans une transaction annulée.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents, platformAdmins } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { resetThrottle } from "./login-throttle";
import {
  createPlatformAdmin,
  getPlatformAdminBySession,
  loginPlatformAdmin,
  logoutPlatformAdmin,
} from "./platform-admin";

class Rollback extends Error {}
async function inRolledBackTx(fn: (tx: Executor) => Promise<void>) {
  await db
    .transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

const PASSWORD = "un-mot-de-passe-solide-42";
const meta = { ip: "203.0.113.7", userAgent: "vitest" };

async function seedAdmin(tx: Executor) {
  return createPlatformAdmin(tx, {
    email: `  Admin.${crypto.randomUUID()}@Ofika.test `,
    name: "Admin Test",
    password: PASSWORD,
  });
}

async function eventsOf(tx: Executor, type: string) {
  return tx.select().from(auditEvents).where(eq(auditEvents.eventType, type));
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
beforeEach(() => resetThrottle());
afterAll(async () => {
  await pool.end();
});

describe("connexion admin plateforme (base réelle)", () => {
  it("connecte avec le bon mot de passe, e-mail insensible à la casse", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await seedAdmin(tx);
      const result = await loginPlatformAdmin(tx, admin.email.toUpperCase(), PASSWORD, meta);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.admin.id).toBe(admin.id);
      expect(result.token.length).toBeGreaterThanOrEqual(43);

      expect(await getPlatformAdminBySession(tx, result.token)).toEqual({
        id: admin.id,
        email: admin.email,
        name: "Admin Test",
      });
      const [login] = await eventsOf(tx, "PLATFORM_ADMIN_LOGIN");
      expect(login).toMatchObject({ actorId: admin.id, ip: meta.ip });
    });
  });

  it("refuse un mauvais mot de passe et un e-mail inconnu avec le même message", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await seedAdmin(tx);
      expect(await loginPlatformAdmin(tx, admin.email, "faux-mot-de-passe", meta)).toEqual({ ok: false, error: "INVALID" });
      expect(await loginPlatformAdmin(tx, "inconnu@ofika.test", PASSWORD, meta)).toEqual({ ok: false, error: "INVALID" });
      expect(await eventsOf(tx, "PLATFORM_ADMIN_LOGIN_FAILED")).toHaveLength(2);
    });
  });

  it("bloque après 5 échecs, même avec le bon mot de passe ensuite", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await seedAdmin(tx);
      for (let i = 0; i < 5; i++) await loginPlatformAdmin(tx, admin.email, "faux", meta);
      expect(await loginPlatformAdmin(tx, admin.email, PASSWORD, meta)).toEqual({ ok: false, error: "LOCKED" });
    });
  });

  it("refuse un compte désactivé et coupe ses sessions", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await seedAdmin(tx);
      const ok = await loginPlatformAdmin(tx, admin.email, PASSWORD, meta);
      if (!ok.ok) throw new Error("login attendu");

      await tx.update(platformAdmins).set({ isActive: false }).where(eq(platformAdmins.id, admin.id));
      expect(await getPlatformAdminBySession(tx, ok.token)).toBeNull();
      expect(await loginPlatformAdmin(tx, admin.email, PASSWORD, meta)).toEqual({ ok: false, error: "INVALID" });
    });
  });

  it("la déconnexion révoque la session", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await seedAdmin(tx);
      const ok = await loginPlatformAdmin(tx, admin.email, PASSWORD, meta);
      if (!ok.ok) throw new Error("login attendu");

      await logoutPlatformAdmin(tx, ok.token, meta);
      expect(await getPlatformAdminBySession(tx, ok.token)).toBeNull();
      expect(await eventsOf(tx, "PLATFORM_ADMIN_LOGOUT")).toHaveLength(1);
    });
  });

  it("refuse un jeton inventé ou absent", async () => {
    await inRolledBackTx(async (tx) => {
      expect(await getPlatformAdminBySession(tx, "jeton-invente")).toBeNull();
      expect(await getPlatformAdminBySession(tx, undefined)).toBeNull();
    });
  });

  it("exige un mot de passe d'au moins 12 caractères", async () => {
    await inRolledBackTx(async (tx) => {
      await expect(createPlatformAdmin(tx, { email: "a@b.c", name: "A", password: "court" })).rejects.toThrow(/12/);
    });
  });
});
