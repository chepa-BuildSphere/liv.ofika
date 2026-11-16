import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { companies, deliveries, platformAdmins, userRoles, users } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity, UserRole } from "@/lib/auth/company-user";
import type { CourierIdentity } from "@/lib/auth/courier";
import type { AdminIdentity } from "@/lib/auth/platform-admin";
import { addCourier } from "@/lib/couriers/couriers";
import {
  assignCourier,
  cancelDelivery,
  confirmCourierPickup,
  createDelivery,
  declareCourierArrived,
  declareCourierFailure,
  forceDeliverDelivery,
} from "@/lib/deliveries/deliveries";
import { changeDeliveryStatus } from "@/lib/deliveries/status";
import { tenantScope } from "@/lib/tenant/scope";
import {
  BillingError,
  computeCompanyPeriodBilling,
  generateMonthlyStatement,
  getCompanyBillingOverview,
  listAllMonthlyStatements,
  listCompanyBillingHistory,
  markMonthlyStatementPaid,
  setCompanyDeliveryPrice,
  toggleCompanyBilling,
} from "./billing";

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

async function setupPlatformAndCompanies(tx: Executor): Promise<{
  platformAdmin: AdminIdentity;
  a: CompanyUserIdentity;
  b: CompanyUserIdentity;
}> {
  const [pa] = await tx
    .insert(platformAdmins)
    .values({
      name: "Admin Plateforme",
      email: `pa.${uid()}@ofika.ci`,
      passwordHash: "scrypt$dummy",
      isActive: true,
    })
    .returning();

  const [cA, cB] = await tx
    .insert(companies)
    .values([
      { name: "Alpha Billing", slug: `alpha-bill-${uid()}` },
      { name: "Beta Billing", slug: `beta-bill-${uid()}` },
    ])
    .returning();

  const now = new Date();
  const [uA, uB] = await tx
    .insert(users)
    .values([
      { companyId: cA.id, name: "Admin Alpha", email: `ba.${uid()}@ex.ci`, activatedAt: now, isActive: true },
      { companyId: cB.id, name: "Admin Beta", email: `bb.${uid()}@ex.ci`, activatedAt: now, isActive: true },
    ])
    .returning();

  await tx.insert(userRoles).values([
    { userId: uA.id, role: "COMPANY_ADMIN" },
    { userId: uB.id, role: "COMPANY_ADMIN" },
  ]);

  return {
    platformAdmin: { id: pa.id, name: pa.name, email: pa.email },
    a: { id: uA.id, name: uA.name, email: uA.email, companyId: cA.id, companyName: cA.name, roles: ["COMPANY_ADMIN"] },
    b: { id: uB.id, name: uB.name, email: uB.email, companyId: cB.id, companyName: cB.name, roles: ["COMPANY_ADMIN"] },
  };
}

async function member(tx: Executor, admin: CompanyUserIdentity, roles: UserRole[]): Promise<CompanyUserIdentity> {
  const [user] = await tenantScope(tx, admin.companyId).insert(users, {
    name: "Membre",
    email: `bm.${uid()}@ex.ci`,
    activatedAt: new Date(),
    isActive: true,
  });
  await tx.insert(userRoles).values(roles.map((role) => ({ userId: user.id, role })));
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: admin.companyId,
    companyName: admin.companyName,
    roles,
  };
}

async function expectBillingError(p: Promise<unknown>, code: BillingError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(BillingError);
  expect((err as BillingError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("réglages facturation ON/OFF, prix par livraison et historique (7.1)", () => {
  it("modifie ON/OFF et le tarif en historisant chaque changement avec l'admin plateforme", async () => {
    await inRolledBackTx(async (tx) => {
      const { platformAdmin, a } = await setupPlatformAndCompanies(tx);

      // Prix initial par défaut = 10 F, billingEnabled = true
      const noop = await setCompanyDeliveryPrice(tx, platformAdmin, a.companyId, 10);
      expect(noop.changed).toBe(false);

      const p1 = await setCompanyDeliveryPrice(tx, platformAdmin, a.companyId, 25);
      expect(p1).toEqual({ changed: true, pricePerDelivery: 25 });

      const t1 = await toggleCompanyBilling(tx, platformAdmin, a.companyId, false);
      expect(t1).toEqual({ changed: true, billingEnabled: false });

      const t2 = await toggleCompanyBilling(tx, platformAdmin, a.companyId, true);
      expect(t2).toEqual({ changed: true, billingEnabled: true });

      const history = await listCompanyBillingHistory(tx, a.companyId);
      expect(history).toHaveLength(3);
      expect(history.map((h) => `${h.setting}:${h.oldValue}->${h.newValue}`).sort()).toEqual([
        "BILLING_ENABLED:false->true",
        "BILLING_ENABLED:true->false",
        "PRICE_PER_DELIVERY:10->25",
      ]);
      expect(history.every((h) => h.changedByAdminName === platformAdmin.name)).toBe(true);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});

describe("calcul du relevé mensuel, vue entreprise et Marquer comme payé (7.2, 7.3 & 7.4)", () => {
  it("calcule le total juste (livrées, forcées comprises, gratuites à 0 F, hors échecs/test) et gère le paiement", async () => {
    await inRolledBackTx(async (tx) => {
      const { platformAdmin, a, b } = await setupPlatformAndCompanies(tx);
      const mgr = await member(tx, a, ["MANAGER"]);
      const ret = await member(tx, a, ["RETURNS_OFFICER"]);

      const cAdd = await addCourier(tx, a, {
        name: "Koffi Facture",
        phone: "+225 07 60 00 00 01",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: cAdd.courierId,
        name: cAdd.name,
        phone: cAdd.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const deliverByQr = async (ref: string) => {
        const d = await createDelivery(tx, a, {
          reference: ref,
          recipientName: "Client",
          recipientPhone: "07 60 11 11 01",
          address: "Cocody",
        });
        await assignCourier(tx, a, d.id, courier.id);
        await confirmCourierPickup(tx, courier, [d.id]);
        await declareCourierArrived(tx, courier, d.id, null);
        return changeDeliveryStatus(tx, {
          companyId: a.companyId,
          deliveryId: d.id,
          to: "DELIVERED",
          proofMethod: "QR",
          actor: { actorType: "COURIER", actorId: courier.id },
        });
      };

      // 1. Livrée à 10 F
      const d1 = await deliverByQr("FAC-10F");
      expect(d1.billedPrice).toBe(10);

      // Changement de tarif -> 25 F (d1 reste figée à 10 F)
      await setCompanyDeliveryPrice(tx, platformAdmin, a.companyId, 25);

      // 2. Livrée à 25 F
      const d2 = await deliverByQr("FAC-25F");
      expect(d2.billedPrice).toBe(25);

      // 3. Forcer Livré (MANUAL) -> 25 F aussi
      const dForcedRaw = await createDelivery(tx, a, {
        reference: "FAC-FORCED",
        recipientName: "Client Forcé",
        recipientPhone: "07 60 11 11 02",
        address: "Marcory",
      });
      await assignCourier(tx, a, dForcedRaw.id, courier.id);
      await confirmCourierPickup(tx, courier, [dForcedRaw.id]);
      const dForced = await forceDeliverDelivery(tx, a, {
        deliveryId: dForcedRaw.id,
        reason: "Confirmé au téléphone",
      });
      expect(dForced.delivery.billedPrice).toBe(25);

      // 4. Passage en période gratuite OFF -> livraison à 0 F
      await toggleCompanyBilling(tx, platformAdmin, a.companyId, false);
      const dFree = await deliverByQr("FAC-FREE");
      expect(dFree.billedPrice).toBe(0);

      // Non facturées : annulée, échec, et test
      const dCancel = await createDelivery(tx, a, {
        reference: "FAC-CANCEL",
        recipientName: "Annulée",
        recipientPhone: "07 60 11 11 03",
        address: "Plateau",
      });
      await cancelDelivery(tx, a, dCancel.id, "Annulée");

      const dFailRaw = await createDelivery(tx, a, {
        reference: "FAC-FAIL",
        recipientName: "Échec",
        recipientPhone: "07 60 11 11 04",
        address: "Abobo",
      });
      await assignCourier(tx, a, dFailRaw.id, courier.id);
      await confirmCourierPickup(tx, courier, [dFailRaw.id]);
      await declareCourierArrived(tx, courier, dFailRaw.id, null);
      await declareCourierFailure(tx, courier, {
        deliveryId: dFailRaw.id,
        failureReason: "RECIPIENT_ABSENT",
      });

      await tx.insert(deliveries).values({
        companyId: a.companyId,
        isTest: true,
        reference: "FAC-TEST",
        recipientName: "Test",
        recipientPhone: "+2250760999999",
        address: "Cocody",
        status: "DELIVERED",
        deliveredAt: new Date(),
      });

      const periodNow = new Date().toISOString().slice(0, 7);
      const computed = await computeCompanyPeriodBilling(tx, a.companyId, periodNow);
      expect(computed).toMatchObject({
        deliveredCount: 4,
        forcedCount: 1,
        freeCount: 1,
        totalAmount: 60, // 10 + 25 + 25 + 0
      });
      expect(computed.priceBreakdown).toEqual([
        { unitPrice: 0, count: 1, subtotal: 0 },
        { unitPrice: 10, count: 1, subtotal: 10 },
        { unitPrice: 25, count: 2, subtotal: 50 },
      ]);

      // Génération et émission du relevé mensuel
      const statement = await generateMonthlyStatement(tx, platformAdmin, a.companyId, periodNow, {
        issue: true,
      });
      expect(statement).toMatchObject({
        deliveredCount: 4,
        freeCount: 1,
        totalAmount: 60,
        status: "ISSUED",
      });

      // Tâche 7.3 : Vue lecture seule admin entreprise vs refus MANAGER/RETURNS_OFFICER & cloisonnement
      await expectBillingError(getCompanyBillingOverview(tx, mgr, periodNow), "FORBIDDEN");
      await expectBillingError(getCompanyBillingOverview(tx, ret, periodNow), "FORBIDDEN");

      const overviewA = await getCompanyBillingOverview(tx, a, periodNow);
      expect(overviewA.currentPeriod.totalAmount).toBe(60);
      expect(overviewA.statements).toHaveLength(1);
      expect(overviewA.history).toHaveLength(2);

      const overviewB = await getCompanyBillingOverview(tx, b, periodNow);
      expect(overviewB.currentPeriod.totalAmount).toBe(0);
      expect(overviewB.statements).toEqual([]);

      // Tâche 7.4 : Marquer comme payé -> PAID + bloque recalcul ultérieur
      const allStatements = await listAllMonthlyStatements(tx, platformAdmin);
      expect(allStatements.some((r) => r.statement.id === statement.id)).toBe(true);

      const paid = await markMonthlyStatementPaid(tx, platformAdmin, statement.id);
      expect(paid.alreadyPaid).toBe(false);
      expect(paid.statement.status).toBe("PAID");
      expect(paid.statement.markedPaidByAdminId).toBe(platformAdmin.id);
      expect(paid.statement.paidAt).not.toBeNull();

      await expectBillingError(
        generateMonthlyStatement(tx, platformAdmin, a.companyId, periodNow),
        "ALREADY_PAID",
      );
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});
