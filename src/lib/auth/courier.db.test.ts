// Connexion livreur : téléphone + PIN, blocage en base après 5 PIN faux.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { companies, companyCouriers, couriers } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { addCourier } from "@/lib/couriers/couriers";
import { completeFirstAccess, issueAccessCode } from "@/lib/couriers/first-access";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { tenantScope } from "@/lib/tenant/scope";
import { activateAccount } from "./activation";
import { loginCompanyUser, getCompanyUserBySession } from "./company-user";
import { getCourierBySession, loginCourier, logoutCourier, PIN_MAX_FAILURES } from "./courier";
import { resetThrottle } from "./login-throttle";
import { createPlatformAdmin, loginPlatformAdmin } from "./platform-admin";

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

const KEY = Buffer.alloc(32, 3);
const uid = () => crypto.randomUUID();
const PIN = "482913";
const phone = () => `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const meta = { ip: "203.0.113.30", userAgent: "Chrome Android" };

async function companyAdmin(tx: Executor, paId: string, name: string) {
  const email = `a.${uid()}@ex.ci`;
  const c = await createCompanyWithAdmin(tx, { companyName: name, adminName: `Admin ${name}`, adminEmail: email }, paId);
  if (!c.ok) throw new Error("création");
  await activateAccount(tx, c.activationToken, "mot-de-passe-admin", "mot-de-passe-admin");
  const r = await loginCompanyUser(tx, email, "mot-de-passe-admin");
  if (!r.ok) throw new Error("login");
  return r.user;
}

/** Livreur rattaché à Alpha (et Beta si `both`), PIN déjà choisi. */
async function courierWithPin(tx: Executor, both = false) {
  const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
  const a = await companyAdmin(tx, pa.id, "Alpha");
  const num = phone();
  const { courierId } = await addCourier(tx, a, { name: "Kwamé", phone: num, employmentType: "EMPLOYEE" });
  const b = both ? await companyAdmin(tx, pa.id, "Beta") : null;
  if (b) await addCourier(tx, b, { name: "Kwamé", phone: num, employmentType: "INDEPENDENT" });
  const { code } = await issueAccessCode(tx, a, courierId, KEY);
  await completeFirstAccess(tx, { phone: num, code, pin: PIN, pinConfirmation: PIN }, KEY);
  return { pa, a, b, num, courierId };
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
beforeEach(() => resetThrottle());
afterAll(async () => {
  await pool.end();
});

describe("connexion livreur (base réelle)", () => {
  it("connexion OK avec le numéro écrit autrement ; voit ses 2 entreprises", async () => {
    await inRolledBackTx(async (tx) => {
      const { num, courierId } = await courierWithPin(tx, true);
      const r = await loginCourier(tx, `+225 ${num}`, PIN, meta);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.courier.id).toBe(courierId);
      expect(r.courier.companies.map((c) => c.name)).toEqual(["Alpha", "Beta"]);
      expect(await getCourierBySession(tx, r.token)).toMatchObject({ id: courierId });
    });
  });

  it("5 PIN faux bloquent le compte 15 min, même avec le bon PIN ensuite", async () => {
    await inRolledBackTx(async (tx) => {
      const { num, courierId } = await courierWithPin(tx);
      for (let i = 0; i < PIN_MAX_FAILURES; i++) {
        expect(await loginCourier(tx, num, "730158", meta)).toEqual({ ok: false, error: "INVALID" });
      }
      const locked = await loginCourier(tx, num, PIN, meta);
      expect(locked.ok).toBe(false);
      if (locked.ok) return;
      expect(locked.error).toBe("LOCKED");
      const minutes = (locked.lockedUntil!.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(14);
      expect(minutes).toBeLessThanOrEqual(15);

      // Le blocage est en base (il survit à un redémarrage du serveur)
      const [c] = await tx.select().from(couriers).where(eq(couriers.id, courierId));
      expect(c.pinLockedUntil).toBeInstanceOf(Date);

      // Fin du blocage : le bon PIN passe et remet le compteur à zéro
      await tx.update(couriers).set({ pinLockedUntil: new Date(Date.now() - 1000) }).where(eq(couriers.id, courierId));
      expect((await loginCourier(tx, num, PIN, meta)).ok).toBe(true);
      const [after] = await tx.select().from(couriers).where(eq(couriers.id, courierId));
      expect(after).toMatchObject({ pinFailedAttempts: 0, pinLockedUntil: null });
    });
  });

  it("une connexion réussie remet le compteur d'erreurs à zéro", async () => {
    await inRolledBackTx(async (tx) => {
      const { num } = await courierWithPin(tx);
      for (let i = 0; i < PIN_MAX_FAILURES - 1; i++) await loginCourier(tx, num, "730158", meta);
      expect((await loginCourier(tx, num, PIN, meta)).ok).toBe(true);
      for (let i = 0; i < PIN_MAX_FAILURES - 1; i++) await loginCourier(tx, num, "730158", meta);
      expect((await loginCourier(tx, num, PIN, meta)).ok).toBe(true); // pas bloqué
    });
  });

  it("numéro inconnu, livreur sans PIN ou désactivé : même message", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, courierId } = await courierWithPin(tx);
      expect(await loginCourier(tx, phone(), PIN, meta)).toEqual({ ok: false, error: "INVALID" });

      const noPin = phone();
      await addCourier(tx, a, { name: "Kono", phone: noPin, employmentType: "EMPLOYEE" });
      expect(await loginCourier(tx, noPin, "000000", meta)).toEqual({ ok: false, error: "INVALID" });

      await tx.update(couriers).set({ isActive: false }).where(eq(couriers.id, courierId));
      const [c] = await tx.select().from(couriers).where(eq(couriers.id, courierId));
      expect(await loginCourier(tx, c.phone, PIN, meta)).toEqual({ ok: false, error: "INVALID" });
    });
  });

  it("déconnexion : la session ne marche plus", async () => {
    await inRolledBackTx(async (tx) => {
      const { num } = await courierWithPin(tx);
      const r = await loginCourier(tx, num, PIN, meta);
      if (!r.ok) throw new Error("login");
      await logoutCourier(tx, r.token, meta);
      expect(await getCourierBySession(tx, r.token)).toBeNull();
    });
  });

  it("détaché ou entreprise suspendue : l'entreprise disparaît de sa liste", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b, num, courierId } = await courierWithPin(tx, true);
      const r = await loginCourier(tx, num, PIN, meta);
      if (!r.ok) throw new Error("login");

      await tenantScope(tx, a.companyId).update(companyCouriers, { isActive: false, detachedAt: new Date() }, eq(companyCouriers.courierId, courierId));
      expect((await getCourierBySession(tx, r.token))?.companies.map((c) => c.name)).toEqual(["Beta"]);

      await tx.update(companies).set({ status: "SUSPENDED" }).where(eq(companies.id, b!.companyId));
      expect((await getCourierBySession(tx, r.token))?.companies).toEqual([]);
    });
  });

  it("les sessions ne se mélangent pas entre espaces", async () => {
    await inRolledBackTx(async (tx) => {
      const { pa, num } = await courierWithPin(tx);
      const courier = await loginCourier(tx, num, PIN, meta);
      if (!courier.ok) throw new Error("login");
      expect(await getCompanyUserBySession(tx, courier.token)).toBeNull();

      const admin = await loginPlatformAdmin(tx, pa.email, "mot-de-passe-plateforme");
      if (!admin.ok) throw new Error("login admin");
      expect(await getCourierBySession(tx, admin.token)).toBeNull();
    });
  });
});
