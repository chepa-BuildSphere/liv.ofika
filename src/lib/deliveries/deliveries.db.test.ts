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
import { importDeliveriesFromCsv } from "./csv-import";
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

  it("import CSV : 100 lignes valides importées + 4 lignes fausses signalées ligne par ligne", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const manager = await member(tx, a, ["MANAGER"]);

      // Une référence déjà existante en base avant l'import
      await createDelivery(tx, a, {
        reference: "CMD-DEJA",
        recipientName: "Déjà Là",
        recipientPhone: "0700000000",
        address: "Plateau",
      });

      const lines = ["reference;destinataire;telephone;adresse;quartier;montant"];
      for (let i = 1; i <= 100; i++) {
        const suffix = String(i).padStart(4, "0");
        lines.push(`CMD-IMP-${suffix};Client ${i};07 00 00 ${suffix.slice(0, 2)} ${suffix.slice(2)};Rue ${i};Cocody;${i * 100}`);
      }
      // 4 lignes en erreur (lignes 102, 103, 104, 105 du fichier)
      lines.push("CMD-ERR-TEL;Client Faux Tel;123;Cocody;Cocody;1000"); // ligne 102 : téléphone invalide
      lines.push("CMD-ERR-ADR;Client Sans Adr;0701020304;;Cocody;1000"); // ligne 103 : adresse manquante
      lines.push("CMD-IMP-0001;Doublon Fichier;0701020305;Yopougon;Yopougon;1000"); // ligne 104 : doublon interne (ligne 2)
      lines.push("CMD-DEJA;Doublon Base;0701020306;Treichville;Treichville;1000"); // ligne 105 : déjà en base

      const res = await importDeliveriesFromCsv(tx, manager, lines.join("\n"), { ip: "203.0.113.15", userAgent: "vitest" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.totalRows).toBe(104);
      expect(res.importedCount).toBe(100);
      expect(res.imported.every((d) => d.status === "CREATED" && d.companyId === a.companyId && !d.isTest)).toBe(true);

      expect(res.errors).toHaveLength(4);
      expect(res.errors.map((e) => ({ line: e.lineNumber, ref: e.reference }))).toEqual([
        { line: 102, ref: "CMD-ERR-TEL" },
        { line: 103, ref: "CMD-ERR-ADR" },
        { line: 104, ref: "CMD-IMP-0001" },
        { line: 105, ref: "CMD-DEJA" },
      ]);
      expect(res.errors[2].message).toContain("ligne 2");

      // Liste : 100 importées + 1 préexistante = 101
      const all = await listDeliveries(tx, a);
      expect(all).toHaveLength(101);

      // Chaîne d'audit intègre sur les 101 événements DELIVERY_CREATED
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("import CSV : cloisonnement entre entreprises et refus pour resp. retours", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const returnsOfficer = await member(tx, a, ["RETURNS_OFFICER"]);

      await createDelivery(tx, b, {
        reference: "CMD-SHARED-REF",
        recipientName: "Client B",
        recipientPhone: "0709090909",
        address: "Treichville",
      });

      const csv = "reference;destinataire;telephone;adresse\nCMD-SHARED-REF;Client A;0708080808;Cocody\n";
      const resA = await importDeliveriesFromCsv(tx, a, csv);
      expect(resA.ok).toBe(true);
      if (resA.ok) {
        expect(resA.importedCount).toBe(1);
        expect(resA.errors).toEqual([]);
      }

      await expectDeliveryError(importDeliveriesFromCsv(tx, returnsOfficer, csv), "FORBIDDEN");
    });
  });
});
