// Livreurs : un téléphone = un livreur, rattachable à plusieurs entreprises.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents, companyCouriers, courierAccessCodes, couriers } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { activateAccount } from "@/lib/auth/activation";
import { loginCompanyUser, type CompanyUserIdentity } from "@/lib/auth/company-user";
import { getCourierBySession, loginCourier } from "@/lib/auth/courier";
import { can, courierActor, userActor } from "@/lib/auth/permissions";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { inviteUser } from "@/lib/team/team";
import { tenantScope } from "@/lib/tenant/scope";
import { addCourier, CourierError, detachCourier, listCouriers } from "./couriers";
import { completeFirstAccess, issueAccessCode } from "./first-access";

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

const uid = () => crypto.randomUUID();
const PASSWORD = "mot-de-passe-livreurs";
/** Numéro ivoirien unique par test (07 + 8 chiffres). */
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

async function member(tx: Executor, admin: CompanyUserIdentity, roles: string[], phoneNumber?: string) {
  const email = `m.${uid()}@ex.ci`;
  const inv = await inviteUser(tx, admin, { name: "Membre", email, roles, ...(phoneNumber ? { phone: phoneNumber } : {}) });
  await activateAccount(tx, inv.token, PASSWORD, PASSWORD);
  const r = await loginCompanyUser(tx, email, PASSWORD);
  if (!r.ok) throw new Error("login");
  return r.user;
}

async function twoCompanies(tx: Executor) {
  const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
  return { a: await companyAdmin(tx, pa.id, "Alpha"), b: await companyAdmin(tx, pa.id, "Beta") };
}

async function expectCourierError(p: Promise<unknown>, code: CourierError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(CourierError);
  expect((err as CourierError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("livreurs (base réelle)", () => {
  it("un même téléphone = un seul livreur, rattaché à 2 entreprises", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const num = phone(); // ex. 0712345678

      const first = await addCourier(tx, a, { name: "Kwamé", phone: num, employmentType: "EMPLOYEE" });
      // Même numéro, autre écriture, autre entreprise, autre nom saisi
      const spaced = `+225 ${num.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
      const second = await addCourier(tx, b, { name: "Kwamé K.", phone: spaced, employmentType: "INDEPENDENT" });

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.courierId).toBe(first.courierId);
      expect(second.name).toBe("Kwamé"); // nom inchangé

      const all = await tx.select().from(couriers).where(eq(couriers.phone, `+225${num}`));
      expect(all).toHaveLength(1);

      const links = await tx.select().from(companyCouriers).where(eq(companyCouriers.courierId, first.courierId));
      expect(links.map((l) => l.companyId).sort()).toEqual([a.companyId, b.companyId].sort());
      // Type de contrat propre à chaque entreprise
      expect(links.find((l) => l.companyId === a.companyId)?.employmentType).toBe("EMPLOYEE");
      expect(links.find((l) => l.companyId === b.companyId)?.employmentType).toBe("INDEPENDENT");
    });
  });

  it("chaque entreprise ne voit que ses livreurs, avec son propre type de contrat", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const shared = phone();
      await addCourier(tx, a, { name: "Kwamé", phone: shared, employmentType: "EMPLOYEE" });
      await addCourier(tx, a, { name: "Kono", phone: phone(), employmentType: "EMPLOYEE" });
      await addCourier(tx, b, { name: "Kwamé", phone: shared, employmentType: "INDEPENDENT" });
      await addCourier(tx, b, { name: "Hervé", phone: phone(), employmentType: "INDEPENDENT" });

      const listA = await listCouriers(tx, a);
      const listB = await listCouriers(tx, b);
      expect(listA.map((c) => c.name)).toEqual(["Kono", "Kwamé"]);
      expect(listB.map((c) => c.name)).toEqual(["Hervé", "Kwamé"]);
      expect(listA.find((c) => c.name === "Kwamé")?.employmentType).toBe("EMPLOYEE");
      expect(listB.find((c) => c.name === "Kwamé")?.employmentType).toBe("INDEPENDENT");
      expect(listA.every((c) => c.hasPin === false)).toBe(true);
    });
  });

  it("refuse d'ajouter deux fois le même livreur dans la même entreprise", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const num = phone();
      await addCourier(tx, a, { name: "Kwamé", phone: num, employmentType: "EMPLOYEE" });
      await expectCourierError(addCourier(tx, a, { name: "Kwamé", phone: `+225${num}`, employmentType: "EMPLOYEE" }), "ALREADY_ATTACHED");
    });
  });

  it("un livreur détaché peut être rattaché à nouveau", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const num = phone();
      const { courierId } = await addCourier(tx, a, { name: "Kwamé", phone: num, employmentType: "EMPLOYEE" });
      await tenantScope(tx, a.companyId).update(
        companyCouriers,
        { isActive: false, detachedAt: new Date() },
        eq(companyCouriers.courierId, courierId),
      );

      const again = await addCourier(tx, a, { name: "Kwamé", phone: num, employmentType: "INDEPENDENT" });
      expect(again).toMatchObject({ courierId, created: false, reattached: true });
      const [link] = await listCouriers(tx, a);
      expect(link).toMatchObject({ attached: true, employmentType: "INDEPENDENT", detachedAt: null });
    });
  });

  it("refuse un numéro, un nom ou un type de contrat invalides", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const err = await addCourier(tx, a, { name: "K", phone: "12", employmentType: "CDD" }).catch((e) => e);
      expect(err).toBeInstanceOf(CourierError);
      expect(Object.keys((err as CourierError).fields ?? {}).sort()).toEqual(["employmentType", "name", "phone"]);
    });
  });

  it("selon la matrice : le gestionnaire gère les livreurs, le resp. retours non", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const manager = await member(tx, a, ["MANAGER"]);
      const returns = await member(tx, a, ["RETURNS_OFFICER"]);

      expect((await addCourier(tx, manager, { name: "Kono", phone: phone(), employmentType: "EMPLOYEE" })).created).toBe(true);
      await expectCourierError(addCourier(tx, returns, { name: "Hervé", phone: phone(), employmentType: "EMPLOYEE" }), "FORBIDDEN");
      await expectCourierError(listCouriers(tx, returns), "FORBIDDEN");
    });
  });

  it("détacher un livreur coupe ses accès chez cette entreprise, révoque son code en attente et garde l'autre entreprise", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const key = Buffer.alloc(32, 7);
      const pin = "482913";

      // Livreur rattaché aux deux entreprises, avec code en attente puis PIN choisi
      const num1 = phone();
      const { courierId } = await addCourier(tx, a, { name: "Kwamé", phone: num1, employmentType: "EMPLOYEE" });
      await addCourier(tx, b, { name: "Kwamé", phone: num1, employmentType: "INDEPENDENT" });
      const { code } = await issueAccessCode(tx, a, courierId, key);
      await completeFirstAccess(tx, { phone: num1, code, pin, pinConfirmation: pin }, key);
      const session = await loginCourier(tx, num1, pin);
      if (!session.ok) throw new Error("login courier");

      // Second livreur sans PIN avec un code d'accès en attente émis par Alpha
      const num2 = phone();
      const pending = await addCourier(tx, a, { name: "Kono", phone: num2, employmentType: "EMPLOYEE" });
      await issueAccessCode(tx, a, pending.courierId, key);

      // Le gestionnaire d'Alpha détache Kwamé et l'admin détache Kono
      const managerA = await member(tx, a, ["MANAGER"]);
      await expect(detachCourier(tx, managerA, courierId)).resolves.toEqual({ courierId, name: "Kwamé" });
      await detachCourier(tx, a, pending.courierId);

      // Liste : attached=false + detachedAt renseigné
      const listA = await listCouriers(tx, a);
      const detached1 = listA.find((c) => c.id === courierId);
      expect(detached1?.attached).toBe(false);
      expect(detached1?.detachedAt).toBeInstanceOf(Date);

      // Événement d'audit COURIER_DETACHED enregistré pour Alpha
      const detachedEvents = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.companyId, a.companyId), eq(auditEvents.eventType, "COURIER_DETACHED")));
      expect(detachedEvents).toHaveLength(2);

      // Le code d'accès en attente émis par Alpha pour Kono a été révoqué
      const [pendingCode] = await tx
        .select()
        .from(courierAccessCodes)
        .where(eq(courierAccessCodes.courierId, pending.courierId));
      expect(pendingCode.revokedAt).toBeInstanceOf(Date);

      // La session de Kwamé ne contient plus Alpha, mais garde Beta ; les droits suivent immédiatement
      const current = await getCourierBySession(tx, session.token);
      expect(current?.companies.map((c) => c.id)).toEqual([b.companyId]);
      expect(
        can(courierActor(current!), "delivery.view", {
          companyId: a.companyId,
          status: "ASSIGNED",
          courierId,
        }).allowed,
      ).toBe(false);
      expect(
        can(courierActor(current!), "delivery.view", {
          companyId: b.companyId,
          status: "ASSIGNED",
          courierId,
        }).allowed,
      ).toBe(true);
    });
  });

  it("refuse de détacher un livreur déjà détaché, d'une autre entreprise, ou par un resp. retours", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const { courierId } = await addCourier(tx, b, { name: "Hervé", phone: phone(), employmentType: "EMPLOYEE" });
      const returnsA = await member(tx, a, ["RETURNS_OFFICER"]);

      await expectCourierError(detachCourier(tx, returnsA, courierId), "FORBIDDEN");
      await expectCourierError(detachCourier(tx, a, courierId), "NOT_FOUND");
      await expectCourierError(detachCourier(tx, a, "pas-un-uuid"), "NOT_FOUND");

      await detachCourier(tx, b, courierId);
      await expectCourierError(detachCourier(tx, b, courierId), "NOT_FOUND");
    });
  });

  it("règle 6 : un utilisateur d'entreprise qui a aussi un compte livreur reçoit son courierId à la connexion", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const sharedPhone = phone();
      const { courierId } = await addCourier(tx, a, { name: "Yao", phone: sharedPhone, employmentType: "EMPLOYEE" });

      // Utilisateur avec le même numéro (écrit avec espaces) + rôles cumulatifs admin + resp. retours
      const spaced = `+225 ${sharedPhone.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
      const dualUser = await member(tx, a, ["COMPANY_ADMIN", "RETURNS_OFFICER"], spaced);
      expect(dualUser.courierId).toBe(courierId);

      // Règle 6 : interdit de forcer Livré ou réceptionner un retour sur ses propres colis
      expect(
        can(userActor(dualUser), "delivery.forceDelivered", {
          companyId: a.companyId,
          status: "ARRIVED",
          courierId,
        }).allowed,
      ).toBe(false);
      expect(
        can(userActor(dualUser), "return.receive", {
          companyId: a.companyId,
          status: "RETURNING",
          courierId,
          returnDeclaredByCourierId: courierId,
        }).allowed,
      ).toBe(false);

      // Sur le colis d'un autre livreur, les mêmes actions sont autorisées
      expect(
        can(userActor(dualUser), "delivery.forceDelivered", {
          companyId: a.companyId,
          status: "ARRIVED",
          courierId: uid(),
        }).allowed,
      ).toBe(true);
    });
  });
});
