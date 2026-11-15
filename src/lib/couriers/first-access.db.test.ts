// Premier accès livreur : code d'accès donné par l'entreprise, PIN choisi par le livreur.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { courierAccessCodes, couriers } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { activateAccount } from "@/lib/auth/activation";
import { loginCompanyUser, type CompanyUserIdentity } from "@/lib/auth/company-user";
import { resetThrottle } from "@/lib/auth/login-throttle";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { verifySecret } from "@/lib/security";
import { inviteUser } from "@/lib/team/team";
import { addCourier } from "./couriers";
import { completeFirstAccess, FirstAccessError, issueAccessCode } from "./first-access";

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

const KEY = Buffer.alloc(32, 9);
const uid = () => crypto.randomUUID();
const PASSWORD = "mot-de-passe-livreurs";
const PIN = "482913";
const phone = () => `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

async function companyAdmin(tx: Executor, paId: string, name: string): Promise<CompanyUserIdentity> {
  const email = `a.${uid()}@ex.ci`;
  const c = await createCompanyWithAdmin(tx, { companyName: name, adminName: `Admin ${name}`, adminEmail: email }, paId);
  if (!c.ok) throw new Error("création");
  await activateAccount(tx, c.activationToken, PASSWORD, PASSWORD);
  const r = await loginCompanyUser(tx, email, PASSWORD);
  if (!r.ok) throw new Error("login");
  return r.user;
}

async function setup(tx: Executor) {
  const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
  const a = await companyAdmin(tx, pa.id, "Alpha");
  const num = phone();
  const added = await addCourier(tx, a, { name: "Kwamé", phone: num, employmentType: "EMPLOYEE" });
  return { pa, a, num, courierId: added.courierId };
}

async function expectFirstAccessError(p: Promise<unknown>, code: FirstAccessError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(FirstAccessError);
  expect((err as FirstAccessError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
beforeEach(() => resetThrottle());
afterAll(async () => {
  await pool.end();
});

describe("premier accès livreur (base réelle)", () => {
  it("le livreur choisit son PIN avec le code ; le PIN est stocké haché", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, num, courierId } = await setup(tx);
      const { code } = await issueAccessCode(tx, a, courierId, KEY);
      expect(code).toMatch(/^\d{6}$/);

      // Le livreur écrit son numéro autrement et le code avec un espace
      const r = await completeFirstAccess(tx, { phone: `+225 ${num}`, code: `${code.slice(0, 3)} ${code.slice(3)}`, pin: PIN, pinConfirmation: PIN }, KEY);
      expect(r).toEqual({ ok: true, courierId });

      const [c] = await tx.select().from(couriers).where(eq(couriers.id, courierId));
      expect(c.pinHash).not.toBeNull();
      expect(c.pinHash).not.toContain(PIN);
      expect(c.pinHash!.startsWith("scrypt$")).toBe(true);
      expect(await verifySecret(PIN, c.pinHash!)).toBe(true);
      expect(c.pinSetAt).toBeInstanceOf(Date);

      // Seule l'empreinte du code d'accès est en base
      const [stored] = await tx.select().from(courierAccessCodes).where(eq(courierAccessCodes.courierId, courierId));
      expect(stored.codeHash).not.toContain(code);
      expect(stored.usedAt).toBeInstanceOf(Date);
    });
  });

  it("le code ne sert qu'une fois, et plus aucun code ne peut être généré ensuite", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, num, courierId } = await setup(tx);
      const { code } = await issueAccessCode(tx, a, courierId, KEY);
      await completeFirstAccess(tx, { phone: num, code, pin: PIN, pinConfirmation: PIN }, KEY);

      expect(await completeFirstAccess(tx, { phone: num, code, pin: "730158", pinConfirmation: "730158" }, KEY)).toEqual({
        ok: false,
        problem: "INVALID",
      });
      await expectFirstAccessError(issueAccessCode(tx, a, courierId, KEY), "PIN_ALREADY_SET");
    });
  });

  it("5 codes faux annulent le code, même si le 6e est le bon", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, num, courierId } = await setup(tx);
      const { code } = await issueAccessCode(tx, a, courierId, KEY);
      const wrong = code === "111111" ? "222222" : "111111";
      for (let i = 0; i < 5; i++) {
        resetThrottle(); // on teste le compteur en base, pas le frein en mémoire
        expect((await completeFirstAccess(tx, { phone: num, code: wrong, pin: PIN, pinConfirmation: PIN }, KEY)).ok).toBe(false);
      }
      resetThrottle();
      expect(await completeFirstAccess(tx, { phone: num, code, pin: PIN, pinConfirmation: PIN }, KEY)).toEqual({ ok: false, problem: "INVALID" });
      const [stored] = await tx.select().from(courierAccessCodes).where(eq(courierAccessCodes.courierId, courierId));
      expect(stored.revokedAt).toBeInstanceOf(Date);
      expect(stored.failedAttempts).toBe(5);
    });
  });

  it("refuse un code expiré, et un nouveau code remplace l'ancien", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, num, courierId } = await setup(tx);
      const first = await issueAccessCode(tx, a, courierId, KEY);
      const second = await issueAccessCode(tx, a, courierId, KEY);
      if (first.code !== second.code) {
        expect((await completeFirstAccess(tx, { phone: num, code: first.code, pin: PIN, pinConfirmation: PIN }, KEY)).ok).toBe(false);
      }
      await tx.update(courierAccessCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(courierAccessCodes.courierId, courierId));
      expect((await completeFirstAccess(tx, { phone: num, code: second.code, pin: PIN, pinConfirmation: PIN }, KEY)).ok).toBe(false);
    });
  });

  it("refuse un PIN trop facile ou mal confirmé, sans consommer le code", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, num, courierId } = await setup(tx);
      const { code } = await issueAccessCode(tx, a, courierId, KEY);
      expect(await completeFirstAccess(tx, { phone: num, code, pin: "123456", pinConfirmation: "123456" }, KEY)).toEqual({ ok: false, problem: "WEAK" });
      expect(await completeFirstAccess(tx, { phone: num, code, pin: PIN, pinConfirmation: "482914" }, KEY)).toEqual({ ok: false, problem: "MISMATCH" });
      expect((await completeFirstAccess(tx, { phone: num, code, pin: PIN, pinConfirmation: PIN }, KEY)).ok).toBe(true);
    });
  });

  it("une entreprise ne génère un code que pour SES livreurs ; resp. retours refusé", async () => {
    await inRolledBackTx(async (tx) => {
      const { pa, a, courierId } = await setup(tx);
      const b = await companyAdmin(tx, pa.id, "Beta");
      await expectFirstAccessError(issueAccessCode(tx, b, courierId, KEY), "NOT_FOUND");

      const email = `r.${uid()}@ex.ci`;
      const inv = await inviteUser(tx, a, { name: "Retours", email, roles: ["RETURNS_OFFICER"] });
      await activateAccount(tx, inv.token, PASSWORD, PASSWORD);
      const r = await loginCompanyUser(tx, email, PASSWORD);
      if (!r.ok) throw new Error("login");
      await expectFirstAccessError(issueAccessCode(tx, r.user, courierId, KEY), "FORBIDDEN");
    });
  });

  it("un numéro inconnu donne la même réponse qu'un mauvais code", async () => {
    await inRolledBackTx(async (tx) => {
      expect(await completeFirstAccess(tx, { phone: phone(), code: "482913", pin: PIN, pinConfirmation: PIN }, KEY)).toEqual({
        ok: false,
        problem: "INVALID",
      });
    });
  });
});
