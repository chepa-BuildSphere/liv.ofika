// Création manuelle et liste des livraisons sur la base `dev`, transaction annulée.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import {
  auditEvents,
  companies,
  deliveries,
  deliveryAttempts,
  manualOverrides,
  qrTokens,
  returnReceptions,
  securityAlerts,
  userRoles,
  users,
} from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity, UserRole } from "@/lib/auth/company-user";
import { getCourierBySession, loginCourier, type CourierIdentity } from "@/lib/auth/courier";
import { addCourier, detachCourier } from "@/lib/couriers/couriers";
import { completeFirstAccess, issueAccessCode } from "@/lib/couriers/first-access";
import { buildReferenceQrPayload } from "@/lib/qr/qr-matrix";
import { hashToken } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import { importDeliveriesFromCsv } from "./csv-import";
import {
  assignCourier,
  cancelDelivery,
  chooseCourierAfterFailure,
  confirmCourierPickup,
  createDelivery,
  declareCourierArrived,
  declareCourierFailure,
  DeliveryError,
  deliveryStatusLabel,
  forceDeliverDelivery,
  generateDeliveryLabelPdf,
  getCourierSummaries,
  getDeliveryDetail,
  getPublicQrStatus,
  issueDeliveryQrToken,
  listCourierDeliveries,
  listDeliveries,
  listReturningDeliveriesGroupedByCourier,
  matchReturningDeliveryByScan,
  QR_TOKEN_TTL_MS,
  receiveDeliveryReturn,
  scanDeliveryQrToken,
  updateDelivery,
  verifyDeliveryHandoverCode,
} from "./deliveries";
import { changeDeliveryStatus } from "./status";

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

async function member(tx: Executor, admin: CompanyUserIdentity, roles: UserRole[]): Promise<CompanyUserIdentity> {
  const email = `m.${uid()}@ex.ci`;
  const [user] = await tenantScope(tx, admin.companyId).insert(users, {
    name: "Membre",
    email,
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

async function twoCompanies(tx: Executor): Promise<{ a: CompanyUserIdentity; b: CompanyUserIdentity }> {
  const [cA, cB] = await tx
    .insert(companies)
    .values([
      { name: "Alpha", slug: `alpha-${uid()}` },
      { name: "Beta", slug: `beta-${uid()}` },
    ])
    .returning();
  const now = new Date();
  const [uA, uB] = await tx
    .insert(users)
    .values([
      { companyId: cA.id, name: "Admin Alpha", email: `a.${uid()}@ex.ci`, activatedAt: now, isActive: true },
      { companyId: cB.id, name: "Admin Beta", email: `b.${uid()}@ex.ci`, activatedAt: now, isActive: true },
    ])
    .returning();
  await tx.insert(userRoles).values([
    { userId: uA.id, role: "COMPANY_ADMIN" },
    { userId: uB.id, role: "COMPANY_ADMIN" },
  ]);
  return {
    a: { id: uA.id, name: uA.name, email: uA.email, companyId: cA.id, companyName: cA.name, roles: ["COMPANY_ADMIN"] },
    b: { id: uB.id, name: uB.name, email: uB.email, companyId: cB.id, companyName: cB.name, roles: ["COMPANY_ADMIN"] },
  };
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

  it("filtres de la liste : statut, livreur (dont non affectée), date / plage, référence et cloisonnement", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const c1 = await addCourier(tx, a, { name: "Kwamé", phone: "0700000101", employmentType: "EMPLOYEE" });
      const c2 = await addCourier(tx, a, { name: "Kono", phone: "0700000102", employmentType: "INDEPENDENT" });
      const cB = await addCourier(tx, b, { name: "Autre", phone: "0700000103", employmentType: "EMPLOYEE" });

      const actor = { actorType: "USER" as const, actorId: a.id };

      // 4 livraisons chez Alpha à des dates, statuts et livreurs différents
      const d1 = await createDelivery(tx, a, {
        reference: "CMD-F1",
        recipientName: "Client 1",
        recipientPhone: "0701111111",
        address: "Cocody",
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d1.id,
        to: "ASSIGNED",
        courierId: c1.courierId,
        actor,
      });

      const d2 = await createDelivery(tx, a, {
        reference: "CMD-F2",
        recipientName: "Client 2",
        recipientPhone: "0702222222",
        address: "Plateau",
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d2.id,
        to: "ASSIGNED",
        courierId: c2.courierId,
        actor,
      });

      const d3 = await createDelivery(tx, a, {
        reference: "CMD-F3",
        recipientName: "Client 3",
        recipientPhone: "0703333333",
        address: "Marcory",
      }); // reste CREATED (non affectée)

      const d4 = await createDelivery(tx, a, {
        reference: "AUTRE-4",
        recipientName: "Client 4",
        recipientPhone: "0704444444",
        address: "Yopougon",
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d4.id,
        to: "CANCELLED",
        actor,
      });

      // Livraison chez Beta à la même date et même statut pour vérifier le cloisonnement
      const dB = await createDelivery(tx, b, {
        reference: "CMD-F1",
        recipientName: "Client B",
        recipientPhone: "0705555555",
        address: "Abobo",
      });
      await changeDeliveryStatus(tx, {
        companyId: b.companyId,
        deliveryId: dB.id,
        to: "ASSIGNED",
        courierId: cB.courierId,
        actor: { actorType: "USER", actorId: b.id },
      });

      // Fixe des dates précises
      await tenantScope(tx, a.companyId).update(
        deliveries,
        { createdAt: new Date("2026-11-10T09:00:00.000Z") },
        eq(deliveries.id, d1.id),
      );
      await tenantScope(tx, a.companyId).update(
        deliveries,
        { createdAt: new Date("2026-11-15T14:30:00.000Z") },
        eq(deliveries.id, d2.id),
      );
      await tenantScope(tx, a.companyId).update(
        deliveries,
        { createdAt: new Date("2026-11-15T23:45:00.000Z") },
        eq(deliveries.id, d3.id),
      );
      await tenantScope(tx, a.companyId).update(
        deliveries,
        { createdAt: new Date("2026-11-16T08:00:00.000Z") },
        eq(deliveries.id, d4.id),
      );
      await tenantScope(tx, b.companyId).update(
        deliveries,
        { createdAt: new Date("2026-11-10T09:00:00.000Z") },
        eq(deliveries.id, dB.id),
      );

      // Filtre par statut
      expect((await listDeliveries(tx, a, { status: "CREATED" })).map((d) => d.reference)).toEqual(["CMD-F3"]);
      expect((await listDeliveries(tx, a, { status: "ASSIGNED" })).map((d) => d.reference)).toEqual(["CMD-F2", "CMD-F1"]);
      expect((await listDeliveries(tx, a, { status: "CANCELLED" })).map((d) => d.reference)).toEqual(["AUTRE-4"]);

      // Filtre par livreur + présence de courierName
      const byC1 = await listDeliveries(tx, a, { courierId: c1.courierId });
      expect(byC1).toHaveLength(1);
      expect(byC1[0]).toMatchObject({ reference: "CMD-F1", courierName: "Kwamé" });

      expect((await listDeliveries(tx, a, { courierId: c2.courierId })).map((d) => d.reference)).toEqual(["CMD-F2"]);
      expect((await listDeliveries(tx, a, { courierId: "UNASSIGNED" })).map((d) => d.reference)).toEqual([
        "AUTRE-4",
        "CMD-F3",
      ]);

      // Filtre par jour et plage from/to
      expect((await listDeliveries(tx, a, { date: "2026-11-10" })).map((d) => d.reference)).toEqual(["CMD-F1"]);
      expect((await listDeliveries(tx, a, { date: "2026-11-15" })).map((d) => d.reference)).toEqual([
        "CMD-F3",
        "CMD-F2",
      ]);
      expect(
        (await listDeliveries(tx, a, { from: "2026-11-10", to: "2026-11-15" })).map((d) => d.reference),
      ).toEqual(["CMD-F3", "CMD-F2", "CMD-F1"]);

      // Filtre par référence + combinaison de filtres
      expect((await listDeliveries(tx, a, { reference: "CMD-F" })).map((d) => d.reference)).toEqual([
        "CMD-F3",
        "CMD-F2",
        "CMD-F1",
      ]);
      expect(
        (await listDeliveries(tx, a, { status: "ASSIGNED", date: "2026-11-15", courierId: c2.courierId })).map(
          (d) => d.reference,
        ),
      ).toEqual(["CMD-F2"]);
    });
  });

  it("modification et annulation possibles avant prise en charge (CREATED et ASSIGNED) avec audit", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const { courierId } = await addCourier(tx, a, { name: "Kwamé", phone: "0700000201", employmentType: "EMPLOYEE" });

      const d1 = await createDelivery(tx, a, {
        reference: "CMD-EDIT-1",
        recipientName: "Awa",
        recipientPhone: "0701010101",
        address: "Cocody",
        metadata: { keepMe: true },
      });
      const d2 = await createDelivery(tx, a, {
        reference: "CMD-EDIT-2",
        recipientName: "Yao",
        recipientPhone: "0702020202",
        address: "Plateau",
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d2.id,
        to: "ASSIGNED",
        courierId,
        actor: { actorType: "USER", actorId: a.id },
      });

      // Modification en CREATED (conserve la même référence et les metadata API existantes)
      const u1 = await updateDelivery(
        tx,
        a,
        d1.id,
        {
          reference: "CMD-EDIT-1",
          recipientName: "Awa Koné",
          recipientPhone: "0505050505",
          address: "Cocody Angré",
          amountToCollect: 20000,
        },
        { ip: "203.0.113.10", userAgent: "vitest" },
      );
      expect(u1).toMatchObject({
        reference: "CMD-EDIT-1",
        recipientName: "Awa Koné",
        recipientPhone: "+2250505050505",
        address: "Cocody Angré",
        amountToCollect: 20000,
        metadata: { keepMe: true },
      });

      // Doublon refusé sur la référence d'une autre livraison
      await expectDeliveryError(
        updateDelivery(tx, a, d1.id, {
          reference: "CMD-EDIT-2",
          recipientName: "Awa Koné",
          recipientPhone: "0505050505",
          address: "Cocody Angré",
        }),
        "DUPLICATE_REFERENCE",
      );

      // Modification en ASSIGNED
      const u2 = await updateDelivery(tx, a, d2.id, {
        reference: "CMD-EDIT-2-BIS",
        recipientName: "Yao Kouassi",
        recipientPhone: "0702020202",
        address: "Plateau Rue du Commerce",
      });
      expect(u2).toMatchObject({ status: "ASSIGNED", reference: "CMD-EDIT-2-BIS", courierId });

      const updatedEvents = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.companyId, a.companyId), eq(auditEvents.eventType, "DELIVERY_UPDATED")));
      expect(updatedEvents).toHaveLength(2);

      // Annulation possible en CREATED et en ASSIGNED
      const c1 = await cancelDelivery(tx, a, d1.id, "Client a annulé");
      const c2 = await cancelDelivery(tx, a, d2.id);
      expect(c1.status).toBe("CANCELLED");
      expect(c1.cancelledAt).toBeInstanceOf(Date);
      expect(c2.status).toBe("CANCELLED");

      const cancelEvents = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.companyId, a.companyId), eq(auditEvents.eventType, "DELIVERY_CANCELLED")));
      expect(cancelEvents).toHaveLength(2);
      expect(cancelEvents[0].payload).toMatchObject({ reason: "Client a annulé" });

      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse modification et annulation après PICKED_UP (et si déjà CANCELLED), cloisonnement et droits", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const returnsOfficer = await member(tx, a, ["RETURNS_OFFICER"]);
      const { courierId } = await addCourier(tx, a, { name: "Kwamé", phone: "0700000202", employmentType: "EMPLOYEE" });

      const d = await createDelivery(tx, a, {
        reference: "CMD-PICKED",
        recipientName: "Kono",
        recipientPhone: "0703030303",
        address: "Marcory",
      });

      // Droits et cloisonnement avant prise en charge
      await expectDeliveryError(
        updateDelivery(tx, returnsOfficer, d.id, {
          reference: "CMD-PICKED",
          recipientName: "Kono",
          recipientPhone: "0703030303",
          address: "Marcory",
        }),
        "FORBIDDEN",
      );
      await expectDeliveryError(cancelDelivery(tx, returnsOfficer, d.id), "FORBIDDEN");
      await expectDeliveryError(cancelDelivery(tx, b, d.id), "NOT_FOUND");
      await expectDeliveryError(
        updateDelivery(tx, b, d.id, {
          reference: "CMD-PICKED",
          recipientName: "Kono",
          recipientPhone: "0703030303",
          address: "Marcory",
        }),
        "NOT_FOUND",
      );

      // Passage à ASSIGNED puis PICKED_UP
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "ASSIGNED",
        courierId,
        actor: { actorType: "USER", actorId: a.id },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: courierId },
      });

      // Modification et annulation refusées dès PICKED_UP
      await expectDeliveryError(
        updateDelivery(tx, a, d.id, {
          reference: "CMD-PICKED-EDIT",
          recipientName: "Autre",
          recipientPhone: "0703030303",
          address: "Autre adresse",
        }),
        "AFTER_PICKUP",
      );
      await expectDeliveryError(cancelDelivery(tx, a, d.id), "AFTER_PICKUP");

      // Passage à ARRIVED puis DELIVERED -> toujours refusé
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "ARRIVED",
        actor: { actorType: "COURIER", actorId: courierId },
      });
      await expectDeliveryError(cancelDelivery(tx, a, d.id), "AFTER_PICKUP");

      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "DELIVERED",
        proofMethod: "QR",
        actor: { actorType: "SYSTEM", actorId: null },
      });
      await expectDeliveryError(
        updateDelivery(tx, a, d.id, {
          reference: "CMD-PICKED-EDIT",
          recipientName: "Autre",
          recipientPhone: "0703030303",
          address: "Autre",
        }),
        "AFTER_PICKUP",
      );

      // Une livraison déjà annulée ne peut plus être modifiée ni ré-annulée
      const cancelled = await createDelivery(tx, a, {
        reference: "CMD-CANC",
        recipientName: "Hervé",
        recipientPhone: "0704040404",
        address: "Yopougon",
      });
      await cancelDelivery(tx, a, cancelled.id);
      await expectDeliveryError(
        updateDelivery(tx, a, cancelled.id, {
          reference: "CMD-CANC-2",
          recipientName: "Hervé",
          recipientPhone: "0704040404",
          address: "Yopougon",
        }),
        "AFTER_PICKUP",
      );
      await expectDeliveryError(cancelDelivery(tx, a, cancelled.id), "AFTER_PICKUP");
    });
  });

  it("affectation, réaffectation, désaffectation et visibilité immédiate côté livreur", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);

      const c1 = await addCourier(tx, a, { name: "Kwamé", phone: "0700000301", employmentType: "EMPLOYEE" });
      const c2 = await addCourier(tx, a, { name: "Kono", phone: "0700000302", employmentType: "INDEPENDENT" });
      const courier1: CourierIdentity = {
        id: c1.courierId,
        name: c1.name,
        phone: c1.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };
      const courier2: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-AFF-1",
        recipientName: "Awa",
        recipientPhone: "0705050505",
        address: "Cocody Riviera",
      });

      // Affectation à Kwamé
      const assigned1 = await assignCourier(tx, a, d.id, c1.courierId, { ip: "203.0.113.10", userAgent: "vitest" });
      expect(assigned1.status).toBe("ASSIGNED");
      expect(assigned1.courierId).toBe(c1.courierId);
      expect(assigned1.assignedAt).toBeInstanceOf(Date);
      expect((await listCourierDeliveries(tx, courier1)).map((x) => x.reference)).toEqual(["CMD-AFF-1"]);
      expect(await listCourierDeliveries(tx, courier2)).toEqual([]);

      // Réaffectation à Kono
      const assigned2 = await assignCourier(tx, a, d.id, c2.courierId);
      expect(assigned2.status).toBe("ASSIGNED");
      expect(assigned2.courierId).toBe(c2.courierId);
      expect(await listCourierDeliveries(tx, courier1)).toEqual([]);
      expect((await listCourierDeliveries(tx, courier2)).map((x) => x.reference)).toEqual(["CMD-AFF-1"]);

      const assignEvents = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.deliveryId, d.id), eq(auditEvents.eventType, "DELIVERY_ASSIGNED")))
        .orderBy(auditEvents.id);
      expect(assignEvents).toHaveLength(2);
      expect(assignEvents[1].payload).toMatchObject({ courierId: c2.courierId, previousCourierId: c1.courierId });

      // Désaffectation -> repasse à CREATED et disparaît chez Kono
      const unassigned = await assignCourier(tx, a, d.id, null);
      expect(unassigned.status).toBe("CREATED");
      expect(unassigned.courierId).toBeNull();
      expect(await listCourierDeliveries(tx, courier2)).toEqual([]);

      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse affectation invalide, après PICKED_UP ou sans droits", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const returnsOfficer: CompanyUserIdentity = { ...a, id: uid(), roles: ["RETURNS_OFFICER"] };

      const cA = await addCourier(tx, a, { name: "Kwamé", phone: "0700000303", employmentType: "EMPLOYEE" });
      const cA2 = await addCourier(tx, a, { name: "Kono", phone: "0700000304", employmentType: "EMPLOYEE" });
      const cB = await addCourier(tx, b, { name: "Hervé", phone: "0700000305", employmentType: "EMPLOYEE" });

      const d = await createDelivery(tx, a, {
        reference: "CMD-AFF-ERR",
        recipientName: "Client",
        recipientPhone: "0706060606",
        address: "Plateau",
      });

      // Droits, cloisonnement et livreur d'une autre entreprise
      await expectDeliveryError(assignCourier(tx, returnsOfficer, d.id, cA.courierId), "FORBIDDEN");
      await expectDeliveryError(assignCourier(tx, b, d.id, cB.courierId), "NOT_FOUND");
      await expectDeliveryError(assignCourier(tx, a, d.id, cB.courierId), "INVALID");

      // Un livreur détaché ne peut plus être affecté
      await detachCourier(tx, a, cA.courierId);
      await expectDeliveryError(assignCourier(tx, a, d.id, cA.courierId), "INVALID");

      // Affecter à Kono puis passer à PICKED_UP -> toute réaffectation ou désaffectation est refusée
      await assignCourier(tx, a, d.id, cA2.courierId);
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: cA2.courierId },
      });
      await expectDeliveryError(assignCourier(tx, a, d.id, null), "AFTER_PICKUP");
      await expectDeliveryError(assignCourier(tx, a, d.id, cA2.courierId), "AFTER_PICKUP");
    });
  });

  it("si un livreur est détaché après affectation, sa session ne voit plus les colis de l'entreprise", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const key = Buffer.alloc(32, 9);
      const pin = "482913";

      const cA = await addCourier(tx, a, { name: "Kwamé", phone: "0700000306", employmentType: "EMPLOYEE" });
      const codeA = await issueAccessCode(tx, a, cA.courierId, key);
      await completeFirstAccess(tx, { phone: "0700000306", code: codeA.code, pin, pinConfirmation: pin }, key);
      const loginA = await loginCourier(tx, "0700000306", pin);
      if (!loginA.ok) throw new Error("login cA");

      const d = await createDelivery(tx, a, {
        reference: "CMD-AFF-DET",
        recipientName: "Client",
        recipientPhone: "0706060607",
        address: "Plateau",
      });
      await assignCourier(tx, a, d.id, cA.courierId);
      expect((await listCourierDeliveries(tx, loginA.courier)).map((x) => x.reference)).toEqual(["CMD-AFF-DET"]);

      await detachCourier(tx, a, cA.courierId);
      const refreshedSession = await getCourierBySession(tx, loginA.token);
      expect(refreshedSession).not.toBeNull();
      expect(await listCourierDeliveries(tx, refreshedSession!)).toEqual([]);
    });
  });
});

describe("getDeliveryDetail — détail et timeline d'historique (3.6)", () => {
  it("retourne le détail et la timeline chronologique complète avec noms d'acteurs, diff et GPS", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const mgr = await member(tx, a, ["MANAGER"]);
      const c1 = await addCourier(tx, a, { name: "Koffi", phone: "+225 07 11 11 01 00", employmentType: "EMPLOYEE" });
      const c2 = await addCourier(tx, a, { name: "Awa", phone: "+225 07 11 11 02 00", employmentType: "INDEPENDENT" });

      const d = await createDelivery(tx, a, {
        reference: "CMD-HIST-01",
        recipientName: "Aïcha Bamba",
        recipientPhone: "07 88 99 00 11",
        address: "Rue des Jardins",
        district: "Cocody",
        amountToCollect: "5000",
        proofMode: "QR",
      });

      await updateDelivery(tx, mgr, d.id, {
        reference: "CMD-HIST-01",
        recipientName: "Aïcha Koné",
        recipientPhone: "07 88 99 00 11",
        address: "Boulevard Latrille",
        district: "Cocody",
        amountToCollect: "7500",
      });

      await assignCourier(tx, a, d.id, c1.courierId);
      await assignCourier(tx, mgr, d.id, c2.courierId);

      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: c2.courierId },
      });

      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "ARRIVED",
        actor: { actorType: "COURIER", actorId: c2.courierId },
        context: { lat: 5.3484, lng: -4.0273, accuracy: 12 },
      });

      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "DELIVERED",
        proofMethod: "QR",
        actor: { actorType: "COURIER", actorId: c2.courierId },
      });

      const detail = await getDeliveryDetail(tx, a, d.id);
      expect(detail.delivery.id).toBe(d.id);
      expect(detail.delivery.status).toBe("DELIVERED");
      expect(detail.delivery.recipientPhone).toBe("+2250788990011");
      expect(detail.courierName).toBe("Awa");
      expect(detail.canViewContact).toBe(true);
      expect(detail.canEdit).toBe(true);

      expect(detail.timeline.map((e) => e.eventType)).toEqual([
        "DELIVERY_CREATED",
        "DELIVERY_UPDATED",
        "DELIVERY_ASSIGNED",
        "DELIVERY_ASSIGNED",
        "DELIVERY_PICKED_UP",
        "DELIVERY_ARRIVED",
        "DELIVERY_DELIVERED",
      ]);

      expect(detail.timeline[0]).toMatchObject({
        label: "Livraison créée",
        summary: "Référence CMD-HIST-01",
        actorName: a.name,
        fromStatus: null,
        toStatus: "CREATED",
      });
      expect(detail.timeline[1]).toMatchObject({
        label: "Livraison modifiée",
        summary: "Champs modifiés : destinataire, adresse, montant",
        actorName: mgr.name,
      });
      expect(detail.timeline[2]).toMatchObject({
        label: "Livreur affecté",
        summary: "Affectée à Koffi",
        actorName: a.name,
      });
      expect(detail.timeline[3]).toMatchObject({
        label: "Livreur réaffecté",
        summary: "Koffi → Awa",
        actorName: mgr.name,
      });
      expect(detail.timeline[4]).toMatchObject({
        label: "Colis récupéré",
        actorName: "Awa",
      });
      expect(detail.timeline[5]).toMatchObject({
        label: "Livreur arrivé sur place",
        actorName: "Awa",
        lat: 5.3484,
        lng: -4.0273,
        accuracy: 12,
      });
      expect(detail.timeline[6]).toMatchObject({
        label: "Livraison effectuée",
        summary: "Preuve : QR code",
        actorName: "Awa",
      });
    });
  });

  it("isole les entreprises et restreint RETURNS_OFFICER aux retours sans téléphone ni événements hors retour", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const ret = await member(tx, a, ["RETURNS_OFFICER"]);
      const c = await addCourier(tx, a, { name: "Yao", phone: "+225 07 22 22 01 00", employmentType: "EMPLOYEE" });

      const d = await createDelivery(tx, a, {
        reference: "CMD-RET-01",
        recipientName: "Sébastien",
        recipientPhone: "07 99 00 11 22",
        address: "Marcory Zone 4",
        proofMode: "QR",
      });

      await expectDeliveryError(getDeliveryDetail(tx, b, d.id), "NOT_FOUND");
      await expectDeliveryError(getDeliveryDetail(tx, a, "not-a-uuid"), "NOT_FOUND");
      await expectDeliveryError(getDeliveryDetail(tx, ret, d.id), "FORBIDDEN");

      await assignCourier(tx, a, d.id, c.courierId);
      await expectDeliveryError(getDeliveryDetail(tx, ret, d.id), "FORBIDDEN");

      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "ARRIVED",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "DELIVERY_FAILED",
        reason: "Client injoignable",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "RETURNING",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });

      const detail = await getDeliveryDetail(tx, ret, d.id);
      expect(detail.delivery.recipientPhone).toBeNull();
      expect(detail.canViewContact).toBe(false);
      expect(detail.canEdit).toBe(false);
      expect(detail.timeline.map((e) => e.eventType)).toEqual(["DELIVERY_RETURNING"]);

      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "RETURN_RECEIVED",
        actor: { actorType: "USER", actorId: ret.id },
      });

      const detailAfter = await getDeliveryDetail(tx, ret, d.id);
      expect(detailAfter.timeline.map((e) => e.eventType)).toEqual([
        "DELIVERY_RETURNING",
        "DELIVERY_RETURN_RECEIVED",
      ]);
      expect(detailAfter.timeline[1]).toMatchObject({
        label: "Retour réceptionné",
        actorName: ret.name,
      });
    });
  });
});

describe("generateDeliveryLabelPdf — bordereau PDF (3.7)", () => {
  it("génère un PDF 1.4 valide pour admin et gestionnaire avec QR de référence et statut", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const mgr = await member(tx, a, ["MANAGER"]);
      const c = await addCourier(tx, a, {
        name: "Koffi Kouamé",
        phone: "+225 07 44 55 66 00",
        employmentType: "EMPLOYEE",
      });

      const d = await createDelivery(tx, a, {
        reference: "CMD-PDF-DB-01",
        recipientName: "Awa Traoré",
        recipientPhone: "07 12 34 56 78",
        address: "Cocody Angré 8e Tranche",
        district: "Cocody",
        amountToCollect: "12000",
        proofMode: "QR",
      });

      await assignCourier(tx, a, d.id, c.courierId);

      const resAdmin = await generateDeliveryLabelPdf(tx, a, d.id);
      const resMgr = await generateDeliveryLabelPdf(tx, mgr, d.id);

      expect(resAdmin.filename).toBe("bordereau-CMD-PDF-DB-01.pdf");
      expect(resMgr.reference).toBe("CMD-PDF-DB-01");

      const decoded = new TextDecoder("latin1").decode(resAdmin.pdf);
      expect(decoded.startsWith("%PDF-1.4\n")).toBe(true);
      expect(decoded.trimEnd().endsWith("%%EOF")).toBe(true);
      expect(decoded).toContain(`OFIKA-REF:CMD-PDF-DB-01:${d.id}`);
      expect(decoded).toContain("Awa Traor");
      expect(decoded).toContain("Koffi Kouam");
    });
  });

  it("refuse autre entreprise, UUID invalide et RETURNS_OFFICER même en retour", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const ret = await member(tx, a, ["RETURNS_OFFICER"]);
      const c = await addCourier(tx, a, {
        name: "Moussa",
        phone: "+225 07 44 55 66 01",
        employmentType: "EMPLOYEE",
      });

      const d = await createDelivery(tx, a, {
        reference: "CMD-PDF-RET-01",
        recipientName: "Sékou",
        recipientPhone: "07 55 66 77 88",
        address: "Yopougon Maroc",
        proofMode: "QR",
      });

      await assignCourier(tx, a, d.id, c.courierId);
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "ARRIVED",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "DELIVERY_FAILED",
        reason: "Absent",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "RETURNING",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });

      await expectDeliveryError(generateDeliveryLabelPdf(tx, b, d.id), "NOT_FOUND");
      await expectDeliveryError(generateDeliveryLabelPdf(tx, a, "not-a-uuid"), "NOT_FOUND");
      await expectDeliveryError(generateDeliveryLabelPdf(tx, ret, d.id), "FORBIDDEN");
    });
  });
});

describe("confirmCourierPickup & Mes colis PWA (4.1, 4.2, 4.3)", () => {
  it("prend en charge un ou plusieurs colis en lot avec PICKED_UP, pickedUpAt serveur et audit COURIER", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const phone = "+225 07 66 77 88 00";
      const cA = await addCourier(tx, a, { name: "Kouadio", phone, employmentType: "INDEPENDENT" });
      await addCourier(tx, b, { name: "Kouadio", phone, employmentType: "INDEPENDENT" });

      const courier: CourierIdentity = {
        id: cA.courierId,
        name: cA.name,
        phone: cA.phone,
        deviceFingerprint: null,
        companies: [
          { id: a.companyId, name: a.companyName },
          { id: b.companyId, name: b.companyName },
        ],
      };

      const d1 = await createDelivery(tx, a, {
        reference: "CMD-PU-01",
        recipientName: "Aminata",
        recipientPhone: "07 11 22 33 44",
        address: "Cocody Danga",
      });
      const d2 = await createDelivery(tx, a, {
        reference: "CMD-PU-02",
        recipientName: "Brice",
        recipientPhone: "07 11 22 33 45",
        address: "Plateau Rue du Commerce",
      });
      const dB = await createDelivery(tx, b, {
        reference: "CMD-PU-B1",
        recipientName: "Mariam",
        recipientPhone: "07 11 22 33 46",
        address: "Marcory Biétry",
      });

      await assignCourier(tx, a, d1.id, cA.courierId);
      await assignCourier(tx, a, d2.id, cA.courierId);
      await assignCourier(tx, b, dB.id, cA.courierId);

      // Prise en charge unitaire (dB)
      const singleRes = await confirmCourierPickup(tx, courier, [dB.id], {
        ip: "198.51.100.5",
        userAgent: "pwa-test",
      });
      expect(singleRes.pickedUpCount).toBe(1);
      expect(singleRes.deliveries[0].status).toBe("PICKED_UP");
      expect(singleRes.deliveries[0].pickedUpAt).toBeInstanceOf(Date);

      // Prise en charge multiple (d1 + d2, avec doublon dédupliqué)
      const batchRes = await confirmCourierPickup(tx, courier, [d1.id, d2.id, d1.id]);
      expect(batchRes.pickedUpCount).toBe(2);
      expect(batchRes.deliveries.map((x) => x.status)).toEqual(["PICKED_UP", "PICKED_UP"]);
      expect(batchRes.deliveries.every((x) => x.pickedUpAt instanceof Date)).toBe(true);

      // Événements d'audit COURIER enregistrés
      const evs = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.deliveryId, d1.id), eq(auditEvents.eventType, "DELIVERY_PICKED_UP")));
      expect(evs).toHaveLength(1);
      expect(evs[0]).toMatchObject({
        actorType: "COURIER",
        actorId: cA.courierId,
        fromStatus: "ASSIGNED",
        toStatus: "PICKED_UP",
      });
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse autre livreur, livreur détaché, colis non ASSIGNED sans mutation partielle, et masque le tél en RETURNING", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const key = Buffer.alloc(32, 7);
      const pin = "619374";

      const c1 = await addCourier(tx, a, { name: "Koffi", phone: "+225 07 77 88 99 01", employmentType: "EMPLOYEE" });
      const c2 = await addCourier(tx, a, { name: "Yao", phone: "+225 07 77 88 99 02", employmentType: "EMPLOYEE" });
      const code1 = await issueAccessCode(tx, a, c1.courierId, key);
      await completeFirstAccess(tx, { phone: c1.phone, code: code1.code, pin, pinConfirmation: pin }, key);
      const login1 = await loginCourier(tx, c1.phone, pin);
      if (!login1.ok) throw new Error("login c1");

      const otherCourier: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d1 = await createDelivery(tx, a, {
        reference: "CMD-PU-ERR1",
        recipientName: "Nadia",
        recipientPhone: "07 33 44 55 01",
        address: "Treichville",
      });
      const d2 = await createDelivery(tx, a, {
        reference: "CMD-PU-ERR2",
        recipientName: "Salif",
        recipientPhone: "07 33 44 55 02",
        address: "Koumassi",
      });

      // Sélection vide ou UUID invalide
      await expectDeliveryError(confirmCourierPickup(tx, login1.courier, []), "INVALID");
      await expectDeliveryError(confirmCourierPickup(tx, login1.courier, ["bad-id"]), "INVALID");

      await assignCourier(tx, a, d1.id, c1.courierId);
      await assignCourier(tx, a, d2.id, c1.courierId);

      // Un autre livreur est refusé
      await expectDeliveryError(confirmCourierPickup(tx, otherCourier, [d1.id]), "FORBIDDEN");

      // Mettre d2 en PICKED_UP puis tenter le lot [d1, d2] : doit échouer et laisser d1 à ASSIGNED (atomicité)
      await confirmCourierPickup(tx, login1.courier, [d2.id]);
      await expectDeliveryError(confirmCourierPickup(tx, login1.courier, [d1.id, d2.id]), "AFTER_PICKUP");
      const [d1Row] = await tenantScope(tx, a.companyId).selectAll(deliveries, eq(deliveries.id, d1.id));
      expect(d1Row.status).toBe("ASSIGNED");

      // Passer d2 vers RETURNING -> listCourierDeliveries masque recipientPhone
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d2.id,
        to: "ARRIVED",
        actor: { actorType: "COURIER", actorId: c1.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d2.id,
        to: "DELIVERY_FAILED",
        reason: "Client absent",
        actor: { actorType: "COURIER", actorId: c1.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d2.id,
        to: "RETURNING",
        actor: { actorType: "COURIER", actorId: c1.courierId },
      });

      const list = await listCourierDeliveries(tx, login1.courier);
      const assignedItem = list.find((x) => x.id === d1.id);
      const returningItem = list.find((x) => x.id === d2.id);
      expect(assignedItem?.recipientPhone).toBe("+2250733445501");
      expect(returningItem?.recipientPhone).toBeNull();

      // Si le livreur est détaché, sa session rechargée est refusée sur d1
      await detachCourier(tx, a, c1.courierId);
      const refreshed = await getCourierBySession(tx, login1.token);
      expect(refreshed).not.toBeNull();
      await expectDeliveryError(confirmCourierPickup(tx, refreshed!, [d1.id]), "FORBIDDEN");
    });
  });
});

describe("declareCourierArrived — arrivée + GPS et tentatives numérotées (4.4)", () => {
  it("passe à ARRIVED avec GPS, crée la tentative n°1, puis incrémente à la tentative n°2 sans GPS après échec", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, {
        name: "Koffi Arrivée",
        phone: "+225 07 88 11 22 00",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-ARR-01",
        recipientName: "Nadine",
        recipientPhone: "07 44 11 22 33",
        address: "Cocody Riviera Golf",
      });
      await assignCourier(tx, a, d.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d.id]);

      // Tentative 1 avec GPS
      const res1 = await declareCourierArrived(
        tx,
        courier,
        d.id,
        { lat: 5.3484, lng: -4.0273, accuracy: 15 },
        { ip: "198.51.100.8", userAgent: "pwa-test" },
      );
      expect(res1.gpsMissing).toBe(false);
      expect(res1.delivery.status).toBe("ARRIVED");
      expect(res1.delivery.currentAttempt).toBe(1);
      expect(res1.attempt).toMatchObject({
        deliveryId: d.id,
        courierId: c.courierId,
        attemptNumber: 1,
        outcome: "IN_PROGRESS",
        arrivedLat: 5.3484,
        arrivedLng: -4.0273,
        arrivedAccuracy: 15,
      });
      expect(res1.attempt.arrivedAt).toBeInstanceOf(Date);

      // Échec -> Nouvelle tentative -> Arrivée n°2 sans GPS
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "DELIVERY_FAILED",
        reason: "Destinataire absent",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: d.id,
        to: "PICKED_UP",
        actor: { actorType: "COURIER", actorId: c.courierId },
      });

      const res2 = await declareCourierArrived(tx, courier, d.id, null);
      expect(res2.gpsMissing).toBe(true);
      expect(res2.delivery.status).toBe("ARRIVED");
      expect(res2.delivery.currentAttempt).toBe(2);
      expect(res2.attempt).toMatchObject({
        attemptNumber: 2,
        outcome: "IN_PROGRESS",
        arrivedLat: null,
        arrivedLng: null,
        arrivedAccuracy: null,
      });

      const attempts = await tx
        .select()
        .from(deliveryAttempts)
        .where(eq(deliveryAttempts.deliveryId, d.id))
        .orderBy(deliveryAttempts.attemptNumber);
      expect(attempts.map((x) => ({ num: x.attemptNumber, outcome: x.outcome }))).toEqual([
        { num: 1, outcome: "FAILED" },
        { num: 2, outcome: "IN_PROGRESS" },
      ]);

      const arrivedEvents = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.deliveryId, d.id), eq(auditEvents.eventType, "DELIVERY_ARRIVED")))
        .orderBy(auditEvents.id);
      expect(arrivedEvents).toHaveLength(2);
      expect(arrivedEvents[0].payload).toMatchObject({ attemptNumber: 1, gpsMissing: false });
      expect(arrivedEvents[1].payload).toMatchObject({ attemptNumber: 2, gpsMissing: true });
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse autre livreur, livreur détaché, UUID inconnu et statuts autres que PICKED_UP", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const key = Buffer.alloc(32, 4);
      const pin = "729405";

      const c1 = await addCourier(tx, a, {
        name: "Koffi 1",
        phone: "+225 07 88 11 22 01",
        employmentType: "EMPLOYEE",
      });
      const c2 = await addCourier(tx, a, {
        name: "Yao 2",
        phone: "+225 07 88 11 22 02",
        employmentType: "EMPLOYEE",
      });

      const code1 = await issueAccessCode(tx, a, c1.courierId, key);
      await completeFirstAccess(tx, { phone: c1.phone, code: code1.code, pin, pinConfirmation: pin }, key);
      const login1 = await loginCourier(tx, c1.phone, pin);
      if (!login1.ok) throw new Error("login c1");

      const otherCourier: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-ARR-ERR",
        recipientName: "Olivier",
        recipientPhone: "07 44 11 22 44",
        address: "Plateau",
      });

      await expectDeliveryError(declareCourierArrived(tx, login1.courier, "not-a-uuid"), "NOT_FOUND");
      await assignCourier(tx, a, d.id, c1.courierId);

      // En ASSIGNED (pas encore pris en charge) -> refusé INVALID
      await expectDeliveryError(declareCourierArrived(tx, login1.courier, d.id), "INVALID");

      // Autre livreur -> FORBIDDEN
      await confirmCourierPickup(tx, login1.courier, [d.id]);
      await expectDeliveryError(declareCourierArrived(tx, otherCourier, d.id), "FORBIDDEN");

      // Livreur détaché -> FORBIDDEN sur session rechargée
      await detachCourier(tx, a, c1.courierId);
      const refreshed = await getCourierBySession(tx, login1.token);
      expect(refreshed).not.toBeNull();
      await expectDeliveryError(declareCourierArrived(tx, refreshed!, d.id), "FORBIDDEN");
    });
  });
});

describe("issueDeliveryQrToken — génération et révocation du QR (4.5)", () => {
  it("génère un jeton haché valable 3 min avec empreinte livreur et révoque l'ancien sur Nouveau QR", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, {
        name: "Koffi QR",
        phone: "+225 07 99 11 22 00",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: "fp-courier-android-01",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-QR-01",
        recipientName: "Awa QR",
        recipientPhone: "07 55 11 22 33",
        address: "Cocody II Plateaux",
      });
      await assignCourier(tx, a, d.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d.id]);
      await declareCourierArrived(tx, courier, d.id, { lat: 5.36, lng: -4.01, accuracy: 10 });

      const beforeMs = Date.now();
      const first = await issueDeliveryQrToken(tx, courier, d.id, {
        appUrl: "https://ofika.ci",
        ip: "198.51.100.12",
        userAgent: "pwa-android",
      });

      expect(first.token.length).toBeGreaterThanOrEqual(22);
      expect(first.confirmUrl).toBe(`https://ofika.ci/c/${first.token}`);
      expect(first.qrSvg.startsWith("<svg ")).toBe(true);
      expect(first.ttlSeconds).toBe(QR_TOKEN_TTL_MS / 1000);
      expect(first.revokedPreviousCount).toBe(0);
      expect(first.attemptNumber).toBe(1);
      expect(first.expiresAt.getTime() - beforeMs).toBeGreaterThanOrEqual(QR_TOKEN_TTL_MS - 10_000);
      expect(first.expiresAt.getTime() - beforeMs).toBeLessThanOrEqual(QR_TOKEN_TTL_MS + 10_000);

      const [firstRow] = await tx
        .select()
        .from(qrTokens)
        .where(eq(qrTokens.id, first.qrTokenId));
      expect(firstRow).toMatchObject({
        deliveryId: d.id,
        attemptId: first.attemptId,
        courierId: c.courierId,
        tokenHash: hashToken(first.token),
        status: "ACTIVE",
        courierDeviceFingerprint: "fp-courier-android-01",
      });
      expect(firstRow.tokenHash).not.toBe(first.token);

      // Cliquer sur "Nouveau QR" -> révoque immédiatement l'ancien jeton
      const second = await issueDeliveryQrToken(tx, courier, d.id, {
        appUrl: "https://ofika.ci",
      });
      expect(second.qrTokenId).not.toBe(first.qrTokenId);
      expect(second.token).not.toBe(first.token);
      expect(second.revokedPreviousCount).toBe(1);

      const rows = await tx
        .select()
        .from(qrTokens)
        .where(eq(qrTokens.deliveryId, d.id))
        .orderBy(qrTokens.createdAt);
      expect(rows).toHaveLength(2);
      const firstAfter = rows.find((r) => r.id === first.qrTokenId);
      const secondAfter = rows.find((r) => r.id === second.qrTokenId);
      expect(firstAfter?.status).toBe("REVOKED");
      expect(secondAfter?.status).toBe("ACTIVE");
      expect(secondAfter?.tokenHash).toBe(hashToken(second.token));

      const qrEvents = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.deliveryId, d.id), eq(auditEvents.eventType, "QR_GENERATED")))
        .orderBy(auditEvents.id);
      expect(qrEvents).toHaveLength(2);
      expect(qrEvents[0].payload).toMatchObject({ revokedPreviousCount: 0 });
      expect(qrEvents[1].payload).toMatchObject({ revokedPreviousCount: 1 });
      expect(JSON.stringify(qrEvents)).not.toContain(first.token);
      expect(JSON.stringify(qrEvents)).not.toContain(second.token);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse avant ARRIVED, pour un autre livreur ou un livreur détaché", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const key = Buffer.alloc(32, 5);
      const pin = "381946";

      const c1 = await addCourier(tx, a, {
        name: "Koffi 1",
        phone: "+225 07 99 11 22 01",
        employmentType: "EMPLOYEE",
      });
      const c2 = await addCourier(tx, a, {
        name: "Yao 2",
        phone: "+225 07 99 11 22 02",
        employmentType: "EMPLOYEE",
      });

      const code1 = await issueAccessCode(tx, a, c1.courierId, key);
      await completeFirstAccess(tx, { phone: c1.phone, code: code1.code, pin, pinConfirmation: pin }, key);
      const login1 = await loginCourier(tx, c1.phone, pin);
      if (!login1.ok) throw new Error("login c1");

      const otherCourier: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-QR-ERR",
        recipientName: "Fatou",
        recipientPhone: "07 55 11 22 44",
        address: "Abobo",
      });

      await expectDeliveryError(issueDeliveryQrToken(tx, login1.courier, "not-a-uuid"), "NOT_FOUND");
      await assignCourier(tx, a, d.id, c1.courierId);
      await expectDeliveryError(issueDeliveryQrToken(tx, login1.courier, d.id), "INVALID");

      await confirmCourierPickup(tx, login1.courier, [d.id]);
      await expectDeliveryError(issueDeliveryQrToken(tx, login1.courier, d.id), "INVALID");

      await declareCourierArrived(tx, login1.courier, d.id, null);
      await expectDeliveryError(issueDeliveryQrToken(tx, otherCourier, d.id), "FORBIDDEN");

      await detachCourier(tx, a, c1.courierId);
      const refreshed = await getCourierBySession(tx, login1.token);
      expect(refreshed).not.toBeNull();
      await expectDeliveryError(issueDeliveryQrToken(tx, refreshed!, d.id), "FORBIDDEN");
    });
  });
});

describe("validation QR complète : scan /c/<jeton>, refus même appareil, 3 essais, DELIVERED + prix figé et alerte appareil (4.6 → 4.11)", () => {
  const masterKey = Buffer.alloc(32, 11);

  it("valide une livraison via /c/<jeton> → DELIVERED, fige billedPrice (ON vs OFF) et verrouille le colis", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, {
        name: "Koffi Valid",
        phone: "+225 07 81 11 22 00",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: "fp-courier-val-01",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d1 = await createDelivery(tx, a, {
        reference: "CMD-VAL-01",
        recipientName: "Awa Valid",
        recipientPhone: "07 81 22 33 01",
        address: "Cocody Angré",
      });
      await assignCourier(tx, a, d1.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d1.id]);
      await declareCourierArrived(tx, courier, d1.id, { lat: 5.38, lng: -3.99, accuracy: 8 });
      const issued = await issueDeliveryQrToken(tx, courier, d1.id);

      const statusBefore = await getPublicQrStatus(tx, issued.token);
      expect(statusBefore).toMatchObject({ found: true, state: "ACTIVE", alreadyScanned: false });

      const scanned = await scanDeliveryQrToken(
        tx,
        issued.token,
        {
          deviceFingerprint: "fp-client-unique-01",
          gps: { lat: 5.3802, lng: -3.9901, accuracy: 10 },
          ip: "198.51.100.20",
          userAgent: "Chrome-Android-Client",
        },
        masterKey,
      );
      expect(scanned.ok).toBe(true);
      if (!scanned.ok || scanned.state !== "CODE_ISSUED") throw new Error("expected CODE_ISSUED");
      expect(scanned.handoverCode).toMatch(/^\d{4}$/);

      const [qrAfterScan] = await tx.select().from(qrTokens).where(eq(qrTokens.id, issued.qrTokenId));
      expect(qrAfterScan.scannedAt).toBeInstanceOf(Date);
      expect(qrAfterScan.handoverCodeHash).not.toBe(scanned.handoverCode);
      expect(qrAfterScan.clientDeviceFingerprint).toBe("fp-client-unique-01");
      expect(qrAfterScan.clientIp).toBe("198.51.100.20");
      expect(qrAfterScan.clientLat).toBe(5.3802);

      const verifyRes = await verifyDeliveryHandoverCode(
        tx,
        courier,
        {
          deliveryId: d1.id,
          code: scanned.handoverCode,
          gps: { lat: 5.38, lng: -3.99, accuracy: 9 },
        },
        masterKey,
      );
      expect(verifyRes).toMatchObject({
        ok: true,
        billedPrice: 10,
        suspiciousDeviceReuse: false,
      });
      if (!verifyRes.ok) throw new Error("expected delivered");
      expect(verifyRes.delivery.status).toBe("DELIVERED");
      expect(verifyRes.delivery.proofMethod).toBe("QR");
      expect(verifyRes.delivery.billedPrice).toBe(10);

      const statusAfter = await getPublicQrStatus(tx, issued.token);
      expect(statusAfter).toMatchObject({ found: true, state: "DELIVERED" });

      const [qrUsed] = await tx.select().from(qrTokens).where(eq(qrTokens.id, issued.qrTokenId));
      expect(qrUsed.status).toBe("USED");
      expect(qrUsed.usedAt).toBeInstanceOf(Date);

      // Verrouillage : plus aucune transition possible après DELIVERED
      await expect(
        changeDeliveryStatus(tx, {
          companyId: a.companyId,
          deliveryId: d1.id,
          to: "DELIVERY_FAILED",
          actor: { actorType: "COURIER", actorId: c.courierId },
        }),
      ).rejects.toMatchObject({ code: "LOCKED" });

      // Test facturation désactivée (billingEnabled = false) -> billedPrice = 0
      await tx.update(companies).set({ billingEnabled: false }).where(eq(companies.id, a.companyId));
      const d2 = await createDelivery(tx, a, {
        reference: "CMD-VAL-FREE",
        recipientName: "Brice",
        recipientPhone: "07 81 22 33 02",
        address: "Marcory",
      });
      await assignCourier(tx, a, d2.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d2.id]);
      await declareCourierArrived(tx, courier, d2.id, null);
      const issued2 = await issueDeliveryQrToken(tx, courier, d2.id);
      const scanned2 = await scanDeliveryQrToken(
        tx,
        issued2.token,
        { deviceFingerprint: "fp-client-unique-02" },
        masterKey,
      );
      if (!scanned2.ok || scanned2.state !== "CODE_ISSUED") throw new Error("expected CODE_ISSUED 2");
      const verify2 = await verifyDeliveryHandoverCode(
        tx,
        courier,
        { deliveryId: d2.id, code: scanned2.handoverCode },
        masterKey,
      );
      expect(verify2).toMatchObject({ ok: true, billedPrice: 0 });
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse scan depuis l'appareil livreur (SAME_DEVICE_REJECTED), verrouille après 3 codes faux et rejette QR expiré", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, {
        name: "Yao Sec",
        phone: "+225 07 82 11 22 00",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: "fp-courier-07",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-SEC-01",
        recipientName: "Fatou Sec",
        recipientPhone: "07 82 22 33 01",
        address: "Yopougon",
      });
      await assignCourier(tx, a, d.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d.id]);
      await declareCourierArrived(tx, courier, d.id, null);
      const issued = await issueDeliveryQrToken(tx, courier, d.id);

      // Refus même appareil (empreinte) et même session livreur (cookie)
      const sameFp = await scanDeliveryQrToken(
        tx,
        issued.token,
        { deviceFingerprint: "fp-courier-07" },
        masterKey,
      );
      expect(sameFp).toMatchObject({ ok: false, code: "SAME_DEVICE" });

      const sameCookie = await scanDeliveryQrToken(
        tx,
        issued.token,
        { deviceFingerprint: "fp-other", courierIdFromCookie: c.courierId },
        masterKey,
      );
      expect(sameCookie).toMatchObject({ ok: false, code: "SAME_DEVICE" });

      const sameEvs = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.deliveryId, d.id), eq(auditEvents.eventType, "SAME_DEVICE_REJECTED")));
      expect(sameEvs).toHaveLength(2);

      // Scan valide client -> 3 codes faux verrouillent le QR (QR_LOCKED)
      const scanned = await scanDeliveryQrToken(
        tx,
        issued.token,
        { deviceFingerprint: "fp-client-sec-01" },
        masterKey,
      );
      if (!scanned.ok || scanned.state !== "CODE_ISSUED") throw new Error("expected CODE_ISSUED");

      const wrongCode = scanned.handoverCode === "0000" ? "9999" : "0000";
      const try1 = await verifyDeliveryHandoverCode(tx, courier, { deliveryId: d.id, code: wrongCode }, masterKey);
      const try2 = await verifyDeliveryHandoverCode(tx, courier, { deliveryId: d.id, code: wrongCode }, masterKey);
      const try3 = await verifyDeliveryHandoverCode(tx, courier, { deliveryId: d.id, code: wrongCode }, masterKey);
      expect(try1).toMatchObject({ ok: false, code: "WRONG_CODE", remainingAttempts: 2 });
      expect(try2).toMatchObject({ ok: false, code: "WRONG_CODE", remainingAttempts: 1 });
      expect(try3).toMatchObject({ ok: false, code: "QR_LOCKED", remainingAttempts: 0 });

      const [lockedQr] = await tx.select().from(qrTokens).where(eq(qrTokens.id, issued.qrTokenId));
      expect(lockedQr.status).toBe("LOCKED");

      // Même le bon code est désormais refusé
      const afterLock = await verifyDeliveryHandoverCode(
        tx,
        courier,
        { deliveryId: d.id, code: scanned.handoverCode },
        masterKey,
      );
      expect(afterLock).toMatchObject({ ok: false, code: "QR_LOCKED" });

      // Nouveau QR expiré -> refusé QR_EXPIRED / EXPIRED
      const issued2 = await issueDeliveryQrToken(tx, courier, d.id);
      await tx
        .update(qrTokens)
        .set({ expiresAt: new Date(Date.now() - 5000) })
        .where(eq(qrTokens.id, issued2.qrTokenId));
      const scanExpired = await scanDeliveryQrToken(
        tx,
        issued2.token,
        { deviceFingerprint: "fp-client-sec-01" },
        masterKey,
      );
      expect(scanExpired).toMatchObject({ ok: false, code: "EXPIRED" });
      const verifyExpired = await verifyDeliveryHandoverCode(
        tx,
        courier,
        { deliveryId: d.id, code: "1234" },
        masterKey,
      );
      expect(verifyExpired).toMatchObject({ ok: false, code: "QR_EXPIRED" });
    });
  });

  it("déclenche une alerte SUSPICIOUS_DEVICE_REUSE si un même appareil client valide 2 livraisons du même livreur", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, {
        name: "Moussa Alerte",
        phone: "+225 07 83 11 22 00",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: "fp-courier-main",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d1 = await createDelivery(tx, a, {
        reference: "CMD-AL-01",
        recipientName: "Client 1",
        recipientPhone: "07 83 22 33 01",
        address: "Plateau",
      });
      const d2 = await createDelivery(tx, a, {
        reference: "CMD-AL-02",
        recipientName: "Client 2",
        recipientPhone: "07 83 22 33 02",
        address: "Cocody",
      });

      const sharedClientFp = "fp-suspect-second-phone";

      for (const d of [d1, d2]) {
        await assignCourier(tx, a, d.id, c.courierId);
        await confirmCourierPickup(tx, courier, [d.id]);
        await declareCourierArrived(tx, courier, d.id, null);
      }

      const qr1 = await issueDeliveryQrToken(tx, courier, d1.id);
      const scan1 = await scanDeliveryQrToken(tx, qr1.token, { deviceFingerprint: sharedClientFp }, masterKey);
      if (!scan1.ok || scan1.state !== "CODE_ISSUED") throw new Error("scan1");
      const v1 = await verifyDeliveryHandoverCode(tx, courier, { deliveryId: d1.id, code: scan1.handoverCode }, masterKey);
      expect(v1).toMatchObject({ ok: true, suspiciousDeviceReuse: false });

      const qr2 = await issueDeliveryQrToken(tx, courier, d2.id);
      const scan2 = await scanDeliveryQrToken(tx, qr2.token, { deviceFingerprint: sharedClientFp }, masterKey);
      if (!scan2.ok || scan2.state !== "CODE_ISSUED") throw new Error("scan2");
      const v2 = await verifyDeliveryHandoverCode(tx, courier, { deliveryId: d2.id, code: scan2.handoverCode }, masterKey);
      expect(v2).toMatchObject({ ok: true, suspiciousDeviceReuse: true });

      const alerts = await tx
        .select()
        .from(securityAlerts)
        .where(eq(securityAlerts.companyId, a.companyId));
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        courierId: c.courierId,
        deliveryId: d2.id,
        type: "SUSPICIOUS_DEVICE_REUSE",
      });

      const [alertAudit] = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.deliveryId, d2.id), eq(auditEvents.eventType, "SUSPICIOUS_DEVICE_REUSE")));
      expect(alertAudit).toBeDefined();
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});

describe("échec de livraison, nouvelle tentative et retour au dépôt (5.1 & 5.2)", () => {
  it("enregistre échec + photo + GPS, révoque le QR, permet nouvelles tentatives puis retour au dépôt", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, {
        name: "Koffi Échec",
        phone: "+225 07 84 11 22 00",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: "fp-courier-fail-01",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-FAIL-01",
        recipientName: "Adama",
        recipientPhone: "07 84 22 33 01",
        address: "Treichville Avenue 12",
      });
      await assignCourier(tx, a, d.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d.id]);
      await declareCourierArrived(tx, courier, d.id, { lat: 5.31, lng: -4.01, accuracy: 10 });
      const activeQr = await issueDeliveryQrToken(tx, courier, d.id);

      const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/";
      const fail1 = await declareCourierFailure(
        tx,
        courier,
        {
          deliveryId: d.id,
          failureReason: "RECIPIENT_ABSENT",
          comment: "Personne au domicile",
          photoUrl: photo,
          gps: { lat: 5.3105, lng: -4.0102, accuracy: 12 },
        },
        { ip: "198.51.100.30", userAgent: "pwa-android" },
      );

      expect(fail1.delivery.status).toBe("DELIVERY_FAILED");
      expect(fail1.gpsMissing).toBe(false);
      expect(fail1.attempt).toMatchObject({
        attemptNumber: 1,
        outcome: "FAILED",
        failureReason: "RECIPIENT_ABSENT",
        failureComment: "Personne au domicile",
        failurePhotoUrl: photo,
        failedLat: 5.3105,
        failedLng: -4.0102,
        afterFailure: null,
      });

      const [qrAfterFail] = await tx.select().from(qrTokens).where(eq(qrTokens.id, activeQr.qrTokenId));
      expect(qrAfterFail.status).toBe("REVOKED");

      // Nouvelle tentative (RETRY) -> PICKED_UP -> nouvelle arrivée (tentative 2)
      const retry = await chooseCourierAfterFailure(tx, courier, d.id, "RETRY");
      expect(retry.delivery.status).toBe("PICKED_UP");
      expect(retry.afterFailure).toBe("RETRY");

      await declareCourierArrived(tx, courier, d.id, null);

      // Motif OTHER sans commentaire refusé
      await expectDeliveryError(
        declareCourierFailure(tx, courier, {
          deliveryId: d.id,
          failureReason: "OTHER",
          comment: "  ",
        }),
        "INVALID",
      );

      // 2e échec avec OTHER + commentaire + suite immédiate RETURN_TO_DEPOT -> RETURNING
      const fail2 = await declareCourierFailure(tx, courier, {
        deliveryId: d.id,
        failureReason: "OTHER",
        comment: "Rue inondée, impossible d'accéder",
        afterFailure: "RETURN_TO_DEPOT",
      });
      expect(fail2.delivery.status).toBe("RETURNING");
      expect(fail2.gpsMissing).toBe(true);
      expect(fail2.attempt).toMatchObject({
        attemptNumber: 2,
        outcome: "FAILED",
        failureReason: "OTHER",
        failureComment: "Rue inondée, impossible d'accéder",
        afterFailure: "RETURN_TO_DEPOT",
      });

      const attempts = await tx
        .select()
        .from(deliveryAttempts)
        .where(eq(deliveryAttempts.deliveryId, d.id))
        .orderBy(deliveryAttempts.attemptNumber);
      expect(attempts).toHaveLength(2);
      expect(attempts[0].afterFailure).toBe("RETRY");
      expect(attempts[1].afterFailure).toBe("RETURN_TO_DEPOT");
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse autre livreur, livreur détaché et transitions hors statut ARRIVED / DELIVERY_FAILED", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const key = Buffer.alloc(32, 6);
      const pin = "504821";

      const c1 = await addCourier(tx, a, {
        name: "Koffi 1",
        phone: "+225 07 85 11 22 01",
        employmentType: "EMPLOYEE",
      });
      const c2 = await addCourier(tx, a, {
        name: "Yao 2",
        phone: "+225 07 85 11 22 02",
        employmentType: "EMPLOYEE",
      });
      const code1 = await issueAccessCode(tx, a, c1.courierId, key);
      await completeFirstAccess(tx, { phone: c1.phone, code: code1.code, pin, pinConfirmation: pin }, key);
      const login1 = await loginCourier(tx, c1.phone, pin);
      if (!login1.ok) throw new Error("login c1");

      const otherCourier: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-FAIL-ERR",
        recipientName: "Bintou",
        recipientPhone: "07 85 22 33 01",
        address: "Abobo Gare",
      });

      await expectDeliveryError(
        declareCourierFailure(tx, login1.courier, {
          deliveryId: "not-a-uuid",
          failureReason: "RECIPIENT_ABSENT",
        }),
        "NOT_FOUND",
      );

      await assignCourier(tx, a, d.id, c1.courierId);
      await confirmCourierPickup(tx, login1.courier, [d.id]);

      // En PICKED_UP -> pas encore ARRIVED : refusé INVALID
      await expectDeliveryError(
        declareCourierFailure(tx, login1.courier, {
          deliveryId: d.id,
          failureReason: "RECIPIENT_ABSENT",
        }),
        "INVALID",
      );
      await expectDeliveryError(chooseCourierAfterFailure(tx, login1.courier, d.id, "RETRY"), "INVALID");

      // Autre livreur -> FORBIDDEN
      await declareCourierArrived(tx, login1.courier, d.id, null);
      await expectDeliveryError(
        declareCourierFailure(tx, otherCourier, {
          deliveryId: d.id,
          failureReason: "RECIPIENT_ABSENT",
        }),
        "FORBIDDEN",
      );

      // Livreur détaché -> FORBIDDEN sur session rechargée
      await detachCourier(tx, a, c1.courierId);
      const refreshed = await getCourierBySession(tx, login1.token);
      expect(refreshed).not.toBeNull();
      await expectDeliveryError(
        declareCourierFailure(tx, refreshed!, {
          deliveryId: d.id,
          failureReason: "RECIPIENT_ABSENT",
        }),
        "FORBIDDEN",
      );
    });
  });
});

describe("réception des retours groupés par livreur (5.3 & 5.4)", () => {
  it("regroupe les retours par livreur, retrouve via QR de référence et enregistre RETURN_RECEIVED", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const retOfficer = await member(tx, a, ["RETURNS_OFFICER"]);

      const c1 = await addCourier(tx, a, { name: "Koffi", phone: "+225 07 90 10 00 01", employmentType: "EMPLOYEE" });
      const c2 = await addCourier(tx, a, { name: "Yao", phone: "+225 07 90 10 00 02", employmentType: "EMPLOYEE" });
      const courier1: CourierIdentity = {
        id: c1.courierId,
        name: c1.name,
        phone: c1.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };
      const courier2: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d1 = await createDelivery(tx, a, {
        reference: "CMD-53-1",
        recipientName: "Awa",
        recipientPhone: "07 91 00 00 01",
        address: "Cocody",
      });
      const d2 = await createDelivery(tx, a, {
        reference: "CMD-53-2",
        recipientName: "Bintou",
        recipientPhone: "07 91 00 00 02",
        address: "Plateau",
      });

      await assignCourier(tx, a, d1.id, c1.courierId);
      await assignCourier(tx, a, d2.id, c2.courierId);
      await confirmCourierPickup(tx, courier1, [d1.id]);
      await confirmCourierPickup(tx, courier2, [d2.id]);
      await declareCourierArrived(tx, courier1, d1.id, null);
      await declareCourierArrived(tx, courier2, d2.id, null);

      await declareCourierFailure(tx, courier1, {
        deliveryId: d1.id,
        failureReason: "RECIPIENT_REFUSED",
        comment: "Client refuse de payer",
        afterFailure: "RETURN_TO_DEPOT",
      });
      await declareCourierFailure(tx, courier2, {
        deliveryId: d2.id,
        failureReason: "WRONG_ADDRESS",
        afterFailure: "RETURN_TO_DEPOT",
      });

      // Clôture côté RETURNS_OFFICER + vérification scan QR
      const overview = await listReturningDeliveriesGroupedByCourier(tx, retOfficer);
      expect(overview.groups).toHaveLength(2);
      expect(overview.groups.map((g) => g.courierName)).toEqual(["Koffi", "Yao"]);
      expect(overview.groups[0].items[0]).toMatchObject({
        id: d1.id,
        reference: "CMD-53-1",
        failureReason: "RECIPIENT_REFUSED",
        failureComment: "Client refuse de payer",
        canReceive: true,
      });

      const scanned = matchReturningDeliveryByScan(
        overview.groups,
        buildReferenceQrPayload({ id: d2.id, reference: d2.reference }),
      );
      expect(scanned?.id).toBe(d2.id);

      // L'entreprise B ne voit aucun des retours de A et ne peut pas réceptionner d1
      const overviewB = await listReturningDeliveriesGroupedByCourier(tx, b);
      expect(overviewB.groups).toEqual([]);
      await expectDeliveryError(
        receiveDeliveryReturn(tx, b, { deliveryId: d1.id, condition: "GOOD" }),
        "NOT_FOUND",
      );

      // Réception de d1 avec état DAMAGED + commentaire + photo
      const received = await receiveDeliveryReturn(tx, retOfficer, {
        deliveryId: d1.id,
        condition: "DAMAGED",
        comment: "Carton écrasé sur un coin",
        photoUrl: "data:image/png;base64,iVBORw0KGgo=",
      });
      expect(received.delivery.status).toBe("RETURN_RECEIVED");
      expect(received.reception).toMatchObject({
        deliveryId: d1.id,
        receivedByUserId: retOfficer.id,
        condition: "DAMAGED",
        comment: "Carton écrasé sur un coin",
      });

      // Double réception refusée (statut devenu RETURN_RECEIVED != RETURNING)
      await expectDeliveryError(
        receiveDeliveryReturn(tx, retOfficer, { deliveryId: d1.id, condition: "GOOD" }),
        "INVALID",
      );

      // Historique + fiche détail montrent la réception et la timeline
      const overviewAfter = await listReturningDeliveriesGroupedByCourier(tx, retOfficer);
      expect(overviewAfter.groups).toHaveLength(1);
      expect(overviewAfter.recentReceived).toHaveLength(1);
      expect(overviewAfter.recentReceived[0]).toMatchObject({
        deliveryId: d1.id,
        condition: "DAMAGED",
        receivedByName: retOfficer.name,
      });

      const detail = await getDeliveryDetail(tx, retOfficer, d1.id);
      expect(detail.returnReception).toMatchObject({
        condition: "DAMAGED",
        comment: "Carton écrasé sur un coin",
        receivedByName: retOfficer.name,
      });
      expect(detail.timeline.at(-1)?.summary).toBe("État : Endommagé — Carton écrasé sur un coin");
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse qu'un utilisateur réceptionne un retour qu'il a déclaré lui-même comme livreur (règle 6)", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, { name: "Kouadio", phone: "+225 07 90 10 00 99", employmentType: "EMPLOYEE" });
      const courierSelf: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };
      const baseOfficer = await member(tx, a, ["RETURNS_OFFICER"]);
      const samePersonOfficer: CompanyUserIdentity = { ...baseOfficer, courierId: c.courierId };

      const d = await createDelivery(tx, a, {
        reference: "CMD-SELF-RET",
        recipientName: "Moussa",
        recipientPhone: "07 92 00 00 01",
        address: "Treichville",
      });
      await assignCourier(tx, a, d.id, c.courierId);
      await confirmCourierPickup(tx, courierSelf, [d.id]);
      await declareCourierArrived(tx, courierSelf, d.id, null);
      await declareCourierFailure(tx, courierSelf, {
        deliveryId: d.id,
        failureReason: "RECIPIENT_ABSENT",
        afterFailure: "RETURN_TO_DEPOT",
      });

      const overview = await listReturningDeliveriesGroupedByCourier(tx, samePersonOfficer);
      expect(overview.groups[0].items[0].canReceive).toBe(false);
      expect(overview.groups[0].items[0].cannotReceiveReason).toMatch(/collègue/i);

      await expectDeliveryError(
        receiveDeliveryReturn(tx, samePersonOfficer, { deliveryId: d.id, condition: "GOOD" }),
        "FORBIDDEN",
      );

      // Un collègue sans ce courierId peut réceptionner
      const colleague = await member(tx, a, ["RETURNS_OFFICER"]);
      const ok = await receiveDeliveryReturn(tx, colleague, { deliveryId: d.id, condition: "GOOD" });
      expect(ok.delivery.status).toBe("RETURN_RECEIVED");
    });
  });
});

describe("Forcer Livré (5.5)", () => {
  it("permet à l'admin de forcer une livraison avec motif, révoque le QR, fige le prix et affiche Livré (forcé)", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCourier(tx, a, { name: "Koffi Force", phone: "+225 07 93 10 00 01", employmentType: "EMPLOYEE" });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: "courier-fp-55",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      const d = await createDelivery(tx, a, {
        reference: "CMD-FORCE-1",
        recipientName: "Mariam",
        recipientPhone: "07 93 20 00 01",
        address: "Yopougon",
      });
      await assignCourier(tx, a, d.id, c.courierId);
      await confirmCourierPickup(tx, courier, [d.id]);
      await declareCourierArrived(tx, courier, d.id, null);
      const qr = await issueDeliveryQrToken(tx, courier, d.id);

      const res = await forceDeliverDelivery(tx, a, {
        deliveryId: d.id,
        reason: "Client a confirmé par téléphone, batterie à plat",
        attachmentUrl: "https://example.com/capture-appel.png",
      });

      expect(res.delivery.status).toBe("DELIVERED");
      expect(res.delivery.proofMethod).toBe("MANUAL");
      expect(res.delivery.billedPrice).toBe(10);
      expect(deliveryStatusLabel(res.delivery.status, res.delivery.proofMethod)).toBe("Livré (forcé)");
      expect(res.override).toMatchObject({
        deliveryId: d.id,
        userId: a.id,
        reason: "Client a confirmé par téléphone, batterie à plat",
      });

      // QR révoqué et livraison verrouillée
      const [qrRow] = await tx.select().from(qrTokens).where(eq(qrTokens.deliveryId, d.id));
      expect(qrRow.status).toBe("REVOKED");
      expect(qr.qrTokenId).toBe(qrRow.id);

      const [overrideRow] = await tx.select().from(manualOverrides).where(eq(manualOverrides.deliveryId, d.id));
      expect(overrideRow.reason).toBe("Client a confirmé par téléphone, batterie à plat");

      const detail = await getDeliveryDetail(tx, a, d.id);
      expect(detail.manualOverride).toMatchObject({
        reason: "Client a confirmé par téléphone, batterie à plat",
        userName: a.name,
      });
      expect(detail.timeline.at(-1)?.eventType).toBe("DELIVERY_FORCED_DELIVERED");
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse Forcer Livré aux non-admins, avant prise en charge, sans motif ou si l'admin est le livreur (règle 6)", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const mgr = await member(tx, a, ["MANAGER"]);
      const ret = await member(tx, a, ["RETURNS_OFFICER"]);
      const c = await addCourier(tx, a, { name: "Admin Livreur", phone: "+225 07 94 10 00 01", employmentType: "EMPLOYEE" });
      const courier: CourierIdentity = {
        id: c.courierId,
        name: c.name,
        phone: c.phone,
        deviceFingerprint: null,
        companies: [{ id: a.companyId, name: a.companyName }],
      };
      const adminWhoIsCourier: CompanyUserIdentity = { ...a, courierId: c.courierId };

      const dBefore = await createDelivery(tx, a, {
        reference: "CMD-FORCE-EARLY",
        recipientName: "Client 1",
        recipientPhone: "07 94 20 00 01",
        address: "Abobo",
      });

      // Avant prise en charge -> INVALID
      await expectDeliveryError(
        forceDeliverDelivery(tx, a, { deliveryId: dBefore.id, reason: "Motif valable" }),
        "INVALID",
      );

      await assignCourier(tx, a, dBefore.id, c.courierId);
      await confirmCourierPickup(tx, courier, [dBefore.id]);

      // Non-admin -> FORBIDDEN
      await expectDeliveryError(
        forceDeliverDelivery(tx, mgr, { deliveryId: dBefore.id, reason: "Motif valable" }),
        "FORBIDDEN",
      );
      await expectDeliveryError(
        forceDeliverDelivery(tx, ret, { deliveryId: dBefore.id, reason: "Motif valable" }),
        "FORBIDDEN",
      );

      // Autre entreprise -> NOT_FOUND
      await expectDeliveryError(
        forceDeliverDelivery(tx, b, { deliveryId: dBefore.id, reason: "Motif valable" }),
        "NOT_FOUND",
      );

      // Motif vide / trop court -> INVALID
      await expectDeliveryError(
        forceDeliverDelivery(tx, a, { deliveryId: dBefore.id, reason: "  " }),
        "INVALID",
      );

      // Règle 6 : admin associé au même livreur -> FORBIDDEN et canForceDelivered false
      const detailSelf = await getDeliveryDetail(tx, adminWhoIsCourier, dBefore.id);
      expect(detailSelf.canForceDelivered).toBe(false);
      expect(detailSelf.cannotForceDeliveredReason).toMatch(/livré vous-même/i);

      await expectDeliveryError(
        forceDeliverDelivery(tx, adminWhoIsCourier, { deliveryId: dBefore.id, reason: "Auto-validation" }),
        "FORBIDDEN",
      );
    });
  });
});

describe("bilan par livreur (5.6)", () => {
  it("calcule Colis pris = livrés + retours + en cours, exclut les colis test et respecte les rôles", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);
      const ret = await member(tx, a, ["RETURNS_OFFICER"]);
      const c1 = await addCourier(tx, a, { name: "Kwamé Bilan", phone: "+225 07 95 10 00 01", employmentType: "EMPLOYEE" });
      const courier: CourierIdentity = {
        id: c1.courierId,
        name: c1.name,
        phone: c1.phone,
        deviceFingerprint: "courier-fp-56",
        companies: [{ id: a.companyId, name: a.companyName }],
      };

      await expectDeliveryError(getCourierSummaries(tx, ret), "FORBIDDEN");

      // 5 livraisons : 1 ASSIGNED (non pris), 1 DELIVERED normal, 1 DELIVERED forcé, 1 RETURN_RECEIVED, 1 RETURNING (en cours)
      const refs = ["BLN-ASSIGNED", "BLN-DELIV", "BLN-FORCED", "BLN-RET-OK", "BLN-RETURNING"] as const;
      const created = [];
      for (let i = 0; i < refs.length; i++) {
        const row = await createDelivery(tx, a, {
          reference: refs[i],
          recipientName: `Dest ${i}`,
          recipientPhone: `07 95 20 00 0${i}`,
          address: "Cocody",
        });
        await assignCourier(tx, a, row.id, c1.courierId);
        created.push(row);
      }

      // 4 prises en charge (BLN-ASSIGNED reste ASSIGNED)
      await confirmCourierPickup(
        tx,
        courier,
        created.slice(1).map((d) => d.id),
      );

      // 1 livraison forcée + 1 livraison QR + 2 retours (1 réceptionné, 1 encore RETURNING)
      await forceDeliverDelivery(tx, a, { deliveryId: created[2].id, reason: "Confirmé par appel" });

      await declareCourierArrived(tx, courier, created[1].id, null);
      await changeDeliveryStatus(tx, {
        companyId: a.companyId,
        deliveryId: created[1].id,
        to: "DELIVERED",
        proofMethod: "QR",
        actor: { actorType: "COURIER", actorId: c1.courierId },
      });

      await declareCourierArrived(tx, courier, created[3].id, null);
      await declareCourierFailure(tx, courier, {
        deliveryId: created[3].id,
        failureReason: "RECIPIENT_ABSENT",
        afterFailure: "RETURN_TO_DEPOT",
      });
      await receiveDeliveryReturn(tx, ret, { deliveryId: created[3].id, condition: "GOOD" });

      await declareCourierArrived(tx, courier, created[4].id, null);
      await declareCourierFailure(tx, courier, {
        deliveryId: created[4].id,
        failureReason: "RECIPIENT_REFUSED",
        afterFailure: "RETURN_TO_DEPOT",
      });

      // Livraison test ignorée dans le bilan
      await tx.insert(deliveries).values({
        companyId: a.companyId,
        isTest: true,
        reference: "BLN-TEST",
        recipientName: "Test",
        recipientPhone: "+2250795999999",
        address: "Cocody",
        status: "DELIVERED",
        courierId: c1.courierId,
      });

      const summariesBefore = await getCourierSummaries(tx, a);
      expect(summariesBefore).toHaveLength(1);
      expect(summariesBefore[0]).toMatchObject({
        courierId: c1.courierId,
        assignedPendingPickup: 1,
        pickedUpTotal: 4,
        delivered: 2,
        forcedDelivered: 1,
        returnReceived: 1,
        activeInTour: 0,
        returning: 1,
        inProgress: 1,
        isSettled: false,
      });
      expect(summariesBefore[0].pickedUpTotal).toBe(
        summariesBefore[0].delivered + summariesBefore[0].returnReceived + summariesBefore[0].inProgress,
      );

      // Réception du dernier retour -> tout est soldé (pickedUpTotal = 2 + 2 + 0 = 4)
      await receiveDeliveryReturn(tx, ret, { deliveryId: created[4].id, condition: "GOOD" });
      const summariesAfter = await getCourierSummaries(tx, a);
      expect(summariesAfter[0]).toMatchObject({
        pickedUpTotal: 4,
        delivered: 2,
        returnReceived: 2,
        inProgress: 0,
        isSettled: true,
      });
    });
  });
});
