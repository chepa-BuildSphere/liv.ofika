// Test d'intégration du service de statut sur la base `dev`, dans une transaction annulée.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents, companies, couriers, deliveries } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import { changeDeliveryStatus, TransitionRefused } from "./status";

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

async function seed(tx: Executor) {
  const [company] = await tx
    .insert(companies)
    .values({ name: "Test SA", slug: `test-${crypto.randomUUID()}` })
    .returning();
  const [courier] = await tx
    .insert(couriers)
    .values({ name: "Kwamé Test", phone: `+test-${crypto.randomUUID()}` })
    .returning();
  const [delivery] = await tx
    .insert(deliveries)
    .values({
      companyId: company.id,
      reference: "CMD-TEST-1",
      recipientName: "Awa",
      recipientPhone: "+2250700000000",
      address: "Cocody, Rue des Jardins",
    })
    .returning();
  return { company, courier, delivery };
}

const admin = { actorType: "USER" as const, actorId: "admin-test" };
const courierActor = { actorType: "COURIER" as const, actorId: "courier-test" };

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") {
    throw new Error("Tests base interdits sur la branche production : faire `neon checkout dev`");
  }
});

afterAll(async () => {
  await pool.end();
});

describe("changeDeliveryStatus (base réelle)", () => {
  it("refuse CREATED → DELIVERED sans rien modifier", async () => {
    await inRolledBackTx(async (tx) => {
      const { delivery } = await seed(tx);

      await expect(
        changeDeliveryStatus(tx, { deliveryId: delivery.id, to: "DELIVERED", proofMethod: "QR", actor: admin }),
      ).rejects.toMatchObject({ name: "TransitionRefused", code: "NOT_ALLOWED" });

      const [after] = await tx.select().from(deliveries).where(eq(deliveries.id, delivery.id));
      expect(after.status).toBe("CREATED");
      const events = await tx.select().from(auditEvents).where(eq(auditEvents.deliveryId, delivery.id));
      expect(events).toHaveLength(0);
    });
  });

  it("parcours complet : affectation → livraison QR, chaque étape auditée", async () => {
    await inRolledBackTx(async (tx) => {
      const { delivery, courier } = await seed(tx);
      const id = delivery.id;

      await changeDeliveryStatus(tx, { deliveryId: id, to: "ASSIGNED", courierId: courier.id, actor: admin });
      await changeDeliveryStatus(tx, { deliveryId: id, to: "PICKED_UP", actor: courierActor });
      await changeDeliveryStatus(tx, {
        deliveryId: id,
        to: "ARRIVED",
        actor: courierActor,
        context: { lat: 5.3364, lng: -4.0267, accuracy: 15 },
      });
      const done = await changeDeliveryStatus(tx, {
        deliveryId: id,
        to: "DELIVERED",
        proofMethod: "QR",
        actor: { actorType: "SYSTEM", actorId: null },
      });

      expect(done.status).toBe("DELIVERED");
      expect(done.proofMethod).toBe("QR");
      expect(done.courierId).toBe(courier.id);
      expect(done.deliveredAt).toBeInstanceOf(Date);

      const events = await tx
        .select({ type: auditEvents.eventType, from: auditEvents.fromStatus, to: auditEvents.toStatus })
        .from(auditEvents)
        .where(eq(auditEvents.deliveryId, id))
        .orderBy(auditEvents.id);
      expect(events).toEqual([
        { type: "DELIVERY_ASSIGNED", from: "CREATED", to: "ASSIGNED" },
        { type: "DELIVERY_PICKED_UP", from: "ASSIGNED", to: "PICKED_UP" },
        { type: "DELIVERY_ARRIVED", from: "PICKED_UP", to: "ARRIVED" },
        { type: "DELIVERY_DELIVERED", from: "ARRIVED", to: "DELIVERED" },
      ]);
      expect((await verifyAuditChain(tx)).ok).toBe(true);

      // Verrouillée : plus rien ne passe
      await expect(
        changeDeliveryStatus(tx, { deliveryId: id, to: "DELIVERY_FAILED", actor: courierActor }),
      ).rejects.toMatchObject({ code: "LOCKED" });
    });
  });

  it("« Forcer Livré » enregistre le motif et MANUAL", async () => {
    await inRolledBackTx(async (tx) => {
      const { delivery, courier } = await seed(tx);
      const id = delivery.id;
      await changeDeliveryStatus(tx, { deliveryId: id, to: "ASSIGNED", courierId: courier.id, actor: admin });
      await changeDeliveryStatus(tx, { deliveryId: id, to: "PICKED_UP", actor: courierActor });

      const forced = await changeDeliveryStatus(tx, {
        deliveryId: id,
        to: "DELIVERED",
        proofMethod: "MANUAL",
        reason: "Client sans batterie, confirmé par appel",
        actor: admin,
      });
      expect(forced.proofMethod).toBe("MANUAL");

      const [ev] = await tx
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.eventType, "DELIVERY_FORCED_DELIVERED"));
      expect(ev.payload).toMatchObject({ reason: "Client sans batterie, confirmé par appel", proofMethod: "MANUAL" });
    });
  });

  it("refuse si le statut a changé entre-temps (expectedFrom)", async () => {
    await inRolledBackTx(async (tx) => {
      const { delivery, courier } = await seed(tx);
      await changeDeliveryStatus(tx, { deliveryId: delivery.id, to: "ASSIGNED", courierId: courier.id, actor: admin });
      const err = await changeDeliveryStatus(tx, {
        deliveryId: delivery.id,
        to: "CANCELLED",
        expectedFrom: "CREATED",
        actor: admin,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(TransitionRefused);
      expect(err.code).toBe("STALE");
    });
  });

  it("refuse une affectation sans livreur", async () => {
    await inRolledBackTx(async (tx) => {
      const { delivery } = await seed(tx);
      await expect(
        changeDeliveryStatus(tx, { deliveryId: delivery.id, to: "ASSIGNED", actor: admin }),
      ).rejects.toThrow(/livreur est obligatoire/);
    });
  });
});
