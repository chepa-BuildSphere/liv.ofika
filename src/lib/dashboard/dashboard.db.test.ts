import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { companies, deliveries, manualOverrides, securityAlerts, userRoles, users } from "@/db/schema";
import { logEvent, verifyAuditChain, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import type { CourierIdentity } from "@/lib/auth/courier";
import { userActor } from "@/lib/auth/permissions";
import { addCourier } from "@/lib/couriers/couriers";
import {
  assignCourier,
  confirmCourierPickup,
  createDelivery,
  declareCourierArrived,
  declareCourierFailure,
  forceDeliverDelivery,
} from "@/lib/deliveries/deliveries";
import { getRecentNotifications } from "@/lib/notifications/notifications";
import { tenantScope } from "@/lib/tenant/scope";
import { getCompanyDashboard, resolveSecurityAlert } from "./dashboard";

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

async function setupCompanyWithAdmin(tx: Executor, name: string): Promise<CompanyUserIdentity> {
  const [c] = await tx
    .insert(companies)
    .values({
      name,
      slug: `comp-${uid().slice(0, 8)}`,
      phone: "+2250700000000",
      status: "ACTIVE",
      billingEnabled: true,
      pricePerDelivery: 10,
    })
    .returning();

  const [u] = await tx
    .insert(users)
    .values({
      companyId: c.id,
      name: `Admin ${name}`,
      email: `admin.${uid()}@test.ci`,
      passwordHash: "dummy",
      isActive: true,
    })
    .returning();

  await tx.insert(userRoles).values([
    { userId: u.id, role: "COMPANY_ADMIN" },
    { userId: u.id, role: "MANAGER" },
    { userId: u.id, role: "RETURNS_OFFICER" },
  ]);

  return {
    id: u.id,
    companyId: c.id,
    companyName: c.name,
    name: u.name,
    email: u.email,
    roles: ["COMPANY_ADMIN", "MANAGER", "RETURNS_OFFICER"],
  };
}

describe("Tableau de bord et notifications (Phase 8 — Tâches 8.1, 8.2, 8.3)", () => {
  beforeAll(async () => {
    if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("calcule les métriques du jour, regroupe par livreur, liste les retours et les livraisons forcées", async () => {
    await inRolledBackTx(async (tx) => {
      const companyUserA = await setupCompanyWithAdmin(tx, "Boutique A");
      const actorA = userActor(companyUserA);

      const companyUserB = await setupCompanyWithAdmin(tx, "Boutique B");

      // Ajouter deux livreurs pour Boutique A
      const c1 = await addCourier(tx, companyUserA, {
        name: "Livreur Alpha",
        phone: `+22507${Math.floor(10000000 + Math.random() * 89999999)}`,
        employmentType: "EMPLOYEE",
      });
      const courier1: CourierIdentity = {
        id: c1.courierId,
        name: c1.name,
        phone: c1.phone,
        deviceFingerprint: null,
        companies: [{ id: companyUserA.companyId, name: companyUserA.companyName }],
      };

      const c2 = await addCourier(tx, companyUserA, {
        name: "Livreur Beta",
        phone: `+22507${Math.floor(10000000 + Math.random() * 89999999)}`,
        employmentType: "EMPLOYEE",
      });
      const courier2: CourierIdentity = {
        id: c2.courierId,
        name: c2.name,
        phone: c2.phone,
        deviceFingerprint: null,
        companies: [{ id: companyUserA.companyId, name: companyUserA.companyName }],
      };

      // 1. Livraison créée non affectée (CREATED)
      const dCreated = await createDelivery(tx, companyUserA, {
        reference: `CMD-CRE-${uid().slice(0, 6)}`,
        recipientName: "Awa",
        recipientPhone: "+2250700000001",
        address: "Cocody Angré",
      });

      // 2. Livraison affectée (ASSIGNED)
      const dAssigned = await createDelivery(tx, companyUserA, {
        reference: `CMD-ASS-${uid().slice(0, 6)}`,
        recipientName: "Bintou",
        recipientPhone: "+2250700000002",
        address: "Plateau",
      });
      await assignCourier(tx, companyUserA, dAssigned.id, courier1.id);

      // 3. Livraison en cours (PICKED_UP)
      const dInTransit = await createDelivery(tx, companyUserA, {
        reference: `CMD-TR-${uid().slice(0, 6)}`,
        recipientName: "Charles",
        recipientPhone: "+2250700000003",
        address: "Yopougon",
      });
      await assignCourier(tx, companyUserA, dInTransit.id, courier1.id);
      await confirmCourierPickup(tx, courier1, [dInTransit.id]);

      // 4. Livraison livrée forcé (DELIVERED via forceDeliverDelivery)
      const dForced = await createDelivery(tx, companyUserA, {
        reference: `CMD-FORCED-${uid().slice(0, 6)}`,
        recipientName: "Désiré",
        recipientPhone: "+2250700000004",
        address: "Marcory",
      });
      await assignCourier(tx, companyUserA, dForced.id, courier1.id);
      await confirmCourierPickup(tx, courier1, [dForced.id]);
      await forceDeliverDelivery(tx, companyUserA, {
        deliveryId: dForced.id,
        reason: "Client injoignable mais confirmation formelle reçue par WhatsApp",
      });

      // 5. Livraison en retour vers le dépôt (RETURNING)
      const dReturning = await createDelivery(tx, companyUserA, {
        reference: `CMD-RET-${uid().slice(0, 6)}`,
        recipientName: "Esther",
        recipientPhone: "+2250700000005",
        address: "Treichville",
      });
      await assignCourier(tx, companyUserA, dReturning.id, courier2.id);
      await confirmCourierPickup(tx, courier2, [dReturning.id]);
      await declareCourierArrived(tx, courier2, dReturning.id, null);
      await declareCourierFailure(tx, courier2, {
        deliveryId: dReturning.id,
        failureReason: "RECIPIENT_UNREACHABLE",
        comment: "Client ne décroche pas après 3 appels",
        afterFailure: "RETURN_TO_DEPOT",
      });

      // 6. Une alerte sécurité active
      const [alert] = await tenantScope(tx, companyUserA.companyId).insert(securityAlerts, {
        courierId: courier1.id,
        deliveryId: dForced.id,
        type: "SUSPICIOUS_DEVICE_REUSE",
        details: {
          clientDeviceFingerprint: "fp_test_device_12345",
          deliveryIds: [dForced.id],
        },
      });

      await logEvent(tx, {
        companyId: companyUserA.companyId,
        deliveryId: dForced.id,
        eventType: "SUSPICIOUS_DEVICE_REUSE",
        actorType: "SYSTEM",
        actorId: null,
        fromStatus: "DELIVERED",
        toStatus: "DELIVERED",
        payload: {
          courierId: courier1.id,
          clientDeviceFingerprint: "fp_test_device_12345",
          deliveryIds: [dForced.id],
        },
      });

      // 7. Une livraison pour l'entreprise B (pour vérifier le cloisonnement)
      const dCompB = await createDelivery(tx, companyUserB, {
        reference: `CMD-B-${uid().slice(0, 6)}`,
        recipientName: "Zack",
        recipientPhone: "+2250700000099",
        address: "Koumassi",
      });

      // Interroger le tableau de bord pour l'entreprise A
      const dashboard = await getCompanyDashboard(actorA, companyUserA.companyId, {}, tx);

      // Vérifications métriques
      expect(dashboard.companyId).toBe(companyUserA.companyId);
      expect(dashboard.isToday).toBe(true);
      expect(dashboard.metrics.created).toBe(1);
      expect(dashboard.metrics.assigned).toBe(1);
      expect(dashboard.metrics.inTransit).toBe(1);
      expect(dashboard.metrics.deliveredForced).toBe(1);
      expect(dashboard.metrics.deliveredTotal).toBe(1);
      expect(dashboard.metrics.returning).toBe(1);

      // Retours non réceptionnés
      expect(dashboard.unreceivedReturns.length).toBeGreaterThanOrEqual(1);
      const retItem = dashboard.unreceivedReturns.find((r) => r.deliveryId === dReturning.id);
      expect(retItem).toBeDefined();
      expect(retItem?.reference).toBe(dReturning.reference);
      expect(retItem?.courierName).toBe("Livreur Beta");

      // Livraisons forcées récentes
      expect(dashboard.forcedDeliveries.length).toBeGreaterThanOrEqual(1);
      const forcedItem = dashboard.forcedDeliveries.find((f) => f.deliveryId === dForced.id);
      expect(forcedItem).toBeDefined();
      expect(forcedItem?.forcedReason).toContain("confirmation formelle");
      expect(forcedItem?.forcedByName).toBe(companyUserA.name);

      // Alertes de sécurité actives
      expect(dashboard.securityAlerts.length).toBe(1);
      expect(dashboard.securityAlerts[0]?.id).toBe(alert.id);
      expect(dashboard.securityAlerts[0]?.type).toBe("SUSPICIOUS_DEVICE_REUSE");

      // Vérifier le cloisonnement : aucune trace de CMD-B
      expect(dashboard.unreceivedReturns.some((r) => r.reference === dCompB.reference)).toBe(false);
      expect(dashboard.forcedDeliveries.some((f) => f.reference === dCompB.reference)).toBe(false);

      // Résoudre l'alerte de sécurité
      const resolveRes = await resolveSecurityAlert(actorA, alert.id, "Vérifié avec le client par téléphone", tx);
      expect(resolveRes.success).toBe(true);

      // Re-vérifier le dashboard : l'alerte n'apparaît plus
      const dashboardAfter = await getCompanyDashboard(actorA, companyUserA.companyId, {}, tx);
      expect(dashboardAfter.securityAlerts.length).toBe(0);

      // Vérifier les notifications in-app récentes
      const notifications = await getRecentNotifications(companyUserA.companyId, 10, tx);
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications.some((n) => n.type === "DELIVERED_FORCED")).toBe(true);
      expect(notifications.some((n) => n.type === "RETURNING")).toBe(true);
      expect(notifications.some((n) => n.type === "SECURITY_ALERT")).toBe(true);

      // Vérification de l'intégrité de la chaîne d'audit
      const auditOk = await verifyAuditChain(tx);
      expect(auditOk.ok).toBe(true);
    });
  });
});
