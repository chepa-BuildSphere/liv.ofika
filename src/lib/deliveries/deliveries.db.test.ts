// Création manuelle et liste des livraisons sur la base `dev`, transaction annulée.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import { activateAccount } from "@/lib/auth/activation";
import { loginCompanyUser, type CompanyUserIdentity } from "@/lib/auth/company-user";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { inviteUser } from "@/lib/team/team";
import { createDelivery, DeliveryError, listDeliveries } from "./deliveries";

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
const PASSWORD = "mot-de-passe-livraisons";

async function companyAdmin(tx: Executor, paId: string, name: string): Promise<CompanyUserIdentity> {
  const email = `a.${uid()}@ex.ci`;
  const c = await createCompanyWithAdmin(tx, { companyName: name, adminName: `Admin ${name}`, adminEmail: email }, paId);
  if (!c.ok) throw new Error("création");
  await activateAccount(tx, c.activationToken, PASSWORD, PASSWORD);
  const r = await loginCompanyUser(tx, email, PASSWORD);
  if (!r.ok) throw new Error("login");
  return r.user;
}

async function member(tx: Executor, admin: CompanyUserIdentity, roles: string[]) {
  const email = `m.${uid()}@ex.ci`;
  const inv = await inviteUser(tx, admin, { name: "Membre", email, roles });
  await activateAccount(tx, inv.token, PASSWORD, PASSWORD);
  const r = await loginCompanyUser(tx, email, PASSWORD);
  if (!r.ok) throw new Error("login");
  return r.user;
}

async function twoCompanies(tx: Executor) {
  const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
  return { a: await companyAdmin(tx, pa.id, "Alpha"), b: await companyAdmin(tx, pa.id, "Beta") };
}

async function expectDeliveryError(p: Promise<unknown>, code: DeliveryError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(DeliveryError);
  expect((err as DeliveryError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("livraisons manuelles (base réelle)", () => {
  it("admin et gestionnaire créent une livraison CREATED + audit DELIVERY_CREATED et chaîne valide", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const manager = await member(tx, a, ["MANAGER"]);

      const d1 = await createDelivery(
        tx,
        a,
        {
          reference: "CMD-1042",
          recipientName: "Awa Koné",
          recipientPhone: "07 07 07 07 07",
          address: "Cocody Angré, 8e tranche",
          district: "Cocody",
          packageDescription: "Colis fragile",
          amountToCollect: 15000,
          comment: "Appeler à l'arrivée",
          metadata: { orderId: 1042 },
        },
        { ip: "203.0.113.10", userAgent: "vitest" },
      );

      const d2 = await createDelivery(tx, manager, {
        reference: "CMD-1043",
        recipientName: "Kouassi",
        recipientPhone: "05 05 05 05 05",
        address: "Plateau Avenue Chardy",
      });

      expect(d1).toMatchObject({
        companyId: a.companyId,
        status: "CREATED",
        isTest: false,
        reference: "CMD-1042",
        recipientPhone: "+2250707070707",
        amountToCollect: 15000,
        proofMode: "QR",
      });
      expect(d2.status).toBe("CREATED");

      const [ev] = await tx.select().from(auditEvents).where(eq(auditEvents.deliveryId, d1.id));
      expect(ev).toMatchObject({
        companyId: a.companyId,
        eventType: "DELIVERY_CREATED",
        actorType: "USER",
        actorId: a.id,
        fromStatus: null,
        toStatus: "CREATED",
      });
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse un doublon de référence dans la même entreprise mais l'autorise ailleurs", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const base = {
        reference: "CMD-999",
        recipientName: "Awa Koné",
        recipientPhone: "0707070707",
        address: "Cocody",
      };

      await createDelivery(tx, a, base);
      await expectDeliveryError(createDelivery(tx, a, base), "DUPLICATE_REFERENCE");

      const other = await createDelivery(tx, b, base);
      expect(other.companyId).toBe(b.companyId);
      expect(other.reference).toBe("CMD-999");
    });
  });

  it("cloisonnement : l'entreprise A ne voit aucune livraison de l'entreprise B", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await createDelivery(tx, a, {
        reference: "CMD-A1",
        recipientName: "Client A",
        recipientPhone: "0701010101",
        address: "Yopougon",
      });
      await createDelivery(tx, b, {
        reference: "CMD-B1",
        recipientName: "Client B",
        recipientPhone: "0702020202",
        address: "Treichville",
      });

      const listA = await listDeliveries(tx, a);
      const listB = await listDeliveries(tx, b);
      expect(listA.map((d) => d.reference)).toEqual(["CMD-A1"]);
      expect(listB.map((d) => d.reference)).toEqual(["CMD-B1"]);
    });
  });

  it("droits : le responsable retours est refusé en création et en liste", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const returnsOfficer = await member(tx, a, ["RETURNS_OFFICER"]);

      await expectDeliveryError(
        createDelivery(tx, returnsOfficer, {
          reference: "CMD-RET",
          recipientName: "Client",
          recipientPhone: "0703030303",
          address: "Abobo",
        }),
        "FORBIDDEN",
      );
      await expectDeliveryError(listDeliveries(tx, returnsOfficer), "FORBIDDEN");
    });
  });
});
