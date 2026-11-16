import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { companies, deliveries, userRoles, users } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import type { CourierIdentity } from "@/lib/auth/courier";
import { addCourier } from "@/lib/couriers/couriers";
import {
  getCourierSummaries,
  listCourierDeliveries,
  listDeliveries,
} from "@/lib/deliveries/deliveries";
import { authenticateApiKey, createApiKey } from "./api-keys";
import {
  handleV1AssignDelivery,
  handleV1CancelDelivery,
  handleV1CreateDelivery,
  handleV1GetDelivery,
  handleV1GetDeliveryEvents,
  handleV1GetDeliveryLabelPdf,
  handleV1ImportDeliveries,
  handleV1ListCouriers,
  handleV1ListDeliveries,
  handleV1PatchDelivery,
  handleV1SimulateDelivery,
} from "./v1-handlers";

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

async function companyAdmin(tx: Executor, label: string): Promise<CompanyUserIdentity> {
  const [c] = await tx
    .insert(companies)
    .values({ name: `Co ${label}`, slug: `co-${label.toLowerCase()}-${uid()}` })
    .returning();
  const [u] = await tx
    .insert(users)
    .values({
      companyId: c.id,
      name: `Admin ${label}`,
      email: `admin.${label.toLowerCase()}.${uid()}@ex.ci`,
      activatedAt: new Date(),
      isActive: true,
    })
    .returning();
  await tx.insert(userRoles).values({ userId: u.id, role: "COMPANY_ADMIN" });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    companyId: c.id,
    companyName: c.name,
    roles: ["COMPANY_ADMIN"],
  };
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("endpoints API REST /v1/* (6.2)", () => {
  it("couvre tous les endpoints §9.2 avec reference, metadata, CSV, PDF et livreurs", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyAdmin(tx, "REST");
      const courierAdd = await addCourier(tx, admin, {
        name: "Koffi API",
        phone: "+225 07 70 00 00 01",
        employmentType: "EMPLOYEE",
      });
      const liveCreated = await createApiKey(tx, admin, { name: "Live REST", environment: "LIVE" });
      const auth = await authenticateApiKey(tx, `Bearer ${liveCreated.secretKey}`);
      if (!auth.ok) throw new Error("auth live failed");
      const apiKey = auth.apiKey;

      // 1. POST /v1/deliveries
      const createRes = await handleV1CreateDelivery(tx, apiKey, {
        reference: "CMD-API-1042",
        recipient_name: "Awa Koné",
        recipient_phone: "07 07 07 07 07",
        address: "Cocody Angré",
        district: "Cocody",
        amount_to_collect: 15000,
        metadata: { order_id: 1042, boutique: "sip" },
        proof_mode: "QR",
      });
      expect(createRes.status).toBe(201);
      const created = createRes.body.data as Record<string, unknown>;
      const id = String(created.id);
      expect(created).toMatchObject({
        reference: "CMD-API-1042",
        metadata: { order_id: 1042, boutique: "sip" },
        status: "CREATED",
        livemode: true,
        is_test: false,
      });

      // 2. GET /v1/couriers
      const couriersRes = await handleV1ListCouriers(tx, apiKey);
      expect(couriersRes.status).toBe(200);
      expect(couriersRes.body.data).toHaveLength(1);

      // 3. GET /v1/deliveries?reference=CMD-API-1042 & GET /v1/deliveries/{id}
      const listByRef = await handleV1ListDeliveries(tx, apiKey, { reference: "CMD-API-1042" });
      expect(listByRef.status).toBe(200);
      expect(listByRef.body.data as unknown[]).toHaveLength(1);

      const getRes = await handleV1GetDelivery(tx, apiKey, id);
      expect(getRes.status).toBe(200);
      expect((getRes.body.data as Record<string, unknown>).reference).toBe("CMD-API-1042");

      // 4. PATCH /v1/deliveries/{id} (partiel avant prise en charge)
      const patchRes = await handleV1PatchDelivery(tx, apiKey, id, {
        address: "Marcory Zone 4",
        comment: "Sonner au portail",
      });
      expect(patchRes.status).toBe(200);
      expect((patchRes.body.data as Record<string, unknown>).address).toBe("Marcory Zone 4");

      // 5. POST /v1/deliveries/{id}/assign
      const assignRes = await handleV1AssignDelivery(tx, apiKey, id, {
        courier_id: courierAdd.courierId,
      });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data).toMatchObject({
        status: "ASSIGNED",
        courier_id: courierAdd.courierId,
      });

      // 6. GET /v1/deliveries/{id}/events & GET /v1/deliveries/{id}/label.pdf
      const eventsRes = await handleV1GetDeliveryEvents(tx, apiKey, id);
      expect(eventsRes.status).toBe(200);
      expect(
        (eventsRes.body.data as Array<{ event_type: string; actor_type: string }>).map(
          (e) => `${e.event_type}:${e.actor_type}`,
        ),
      ).toEqual([
        "DELIVERY_CREATED:API_KEY",
        "DELIVERY_UPDATED:API_KEY",
        "DELIVERY_ASSIGNED:API_KEY",
      ]);

      const pdfRes = await handleV1GetDeliveryLabelPdf(tx, apiKey, id);
      expect(pdfRes.ok).toBe(true);
      if (pdfRes.ok) {
        expect(new TextDecoder("latin1").decode(pdfRes.pdf).startsWith("%PDF-1.4\n")).toBe(true);
      }

      // 7. POST /v1/deliveries/{id}/cancel
      const cancelRes = await handleV1CancelDelivery(tx, apiKey, id, {
        reason: "Commande annulée sur la boutique",
      });
      expect(cancelRes.status).toBe(200);
      expect((cancelRes.body.data as Record<string, unknown>).status).toBe("CANCELLED");

      // 8. POST /v1/deliveries/import
      const csvRes = await handleV1ImportDeliveries(
        tx,
        apiKey,
        "reference;destinataire;telephone;adresse\nCMD-CSV-1;Yao;0505050505;Plateau\n",
      );
      expect(csvRes.status).toBe(201);
      expect(csvRes.body.imported_count).toBe(1);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});

describe("mode test & simulation /v1/test (6.3 & 6.4)", () => {
  it("cloisonne strictement test/live, cache test aux livreurs/stats/UI par défaut et simule via clé test uniquement", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyAdmin(tx, "MODE");
      const cAdd = await addCourier(tx, admin, {
        name: "Yao Test",
        phone: "+225 07 71 00 00 01",
        employmentType: "EMPLOYEE",
      });
      const courier: CourierIdentity = {
        id: cAdd.courierId,
        name: cAdd.name,
        phone: cAdd.phone,
        deviceFingerprint: null,
        companies: [{ id: admin.companyId, name: admin.companyName }],
      };

      const testKeyRes = await createApiKey(tx, admin, { name: "Test Key", environment: "TEST" });
      const liveKeyRes = await createApiKey(tx, admin, { name: "Live Key", environment: "LIVE" });
      const authTest = await authenticateApiKey(tx, testKeyRes.secretKey);
      const authLive = await authenticateApiKey(tx, liveKeyRes.secretKey);
      if (!authTest.ok || !authLive.ok) throw new Error("auth failed");
      const testKey = authTest.apiKey;
      const liveKey = authLive.apiKey;

      // Même référence autorisée en test et en prod (index unique company_id, is_test, reference)
      const createTest = await handleV1CreateDelivery(tx, testKey, {
        reference: "CMD-MEME-REF",
        recipient_name: "Client Test",
        recipient_phone: "07 71 11 11 01",
        address: "Cocody",
      });
      const createLive = await handleV1CreateDelivery(tx, liveKey, {
        reference: "CMD-MEME-REF",
        recipient_name: "Client Réel",
        recipient_phone: "07 71 11 11 02",
        address: "Cocody",
      });
      expect(createTest.status).toBe(201);
      expect(createLive.status).toBe(201);

      const testId = String((createTest.body.data as Record<string, unknown>).id);
      const liveId = String((createLive.body.data as Record<string, unknown>).id);
      expect((createTest.body.data as Record<string, unknown>).is_test).toBe(true);
      expect((createTest.body.data as Record<string, unknown>).livemode).toBe(false);
      expect((createLive.body.data as Record<string, unknown>).is_test).toBe(false);
      expect((createLive.body.data as Record<string, unknown>).livemode).toBe(true);

      // Clé TEST ne voit/modifie jamais LIVE, et inversement
      const testList = await handleV1ListDeliveries(tx, testKey);
      expect((testList.body.data as Array<{ id: string }>).map((d) => d.id)).toEqual([testId]);
      expect((await handleV1GetDelivery(tx, testKey, liveId)).status).toBe(404);
      expect(
        (await handleV1PatchDelivery(tx, testKey, liveId, { address: "Piratée" })).status,
      ).toBe(404);

      const liveList = await handleV1ListDeliveries(tx, liveKey);
      expect((liveList.body.data as Array<{ id: string }>).map((d) => d.id)).toEqual([liveId]);
      expect((await handleV1GetDelivery(tx, liveKey, testId)).status).toBe(404);

      // Cachée par défaut dans l'UI entreprise, visible avec includeTest: true
      const hiddenUi = await listDeliveries(tx, admin);
      expect(hiddenUi.map((d) => d.id)).toEqual([liveId]);
      const shownUi = await listDeliveries(tx, admin, { includeTest: true });
      expect(shownUi).toHaveLength(2);

      // Simulate refusé avec clé LIVE (403)
      const simForbidden = await handleV1SimulateDelivery(tx, liveKey, testId, { status: "DELIVERED" });
      expect(simForbidden.status).toBe(403);

      // Simulate sur livraison test : ASSIGNED (avec livreur) -> DELIVERED (billed_price = 0)
      const simAssign = await handleV1SimulateDelivery(tx, testKey, testId, {
        status: "ASSIGNED",
        courier_id: courier.id,
      });
      expect(simAssign.status).toBe(200);
      expect((simAssign.body.data as Record<string, unknown>).status).toBe("ASSIGNED");

      // Jamais envoyée aux livreurs
      expect(await listCourierDeliveries(tx, courier)).toEqual([]);

      const simDeliver = await handleV1SimulateDelivery(tx, testKey, testId, {
        status: "DELIVERED",
      });
      expect(simDeliver.status).toBe(200);
      expect(simDeliver.body.data).toMatchObject({
        status: "DELIVERED",
        proof_method: "QR",
        billed_price: null,
        livemode: false,
      });

      // Jamais comptée dans les statistiques / bilan livreur
      const summaries = await getCourierSummaries(tx, admin);
      expect(summaries[0]).toMatchObject({
        pickedUpTotal: 0,
        delivered: 0,
        assignedPendingPickup: 0,
      });

      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});

describe("Idempotency-Key sur les POST (6.5)", () => {
  it("évite la double création avec la même clé et refuse 409 si le corps change", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyAdmin(tx, "IDEMP");
      const keyRes = await createApiKey(tx, admin, { name: "Idemp Key", environment: "LIVE" });
      const auth = await authenticateApiKey(tx, keyRes.secretKey);
      if (!auth.ok) throw new Error("auth failed");
      const apiKey = auth.apiKey;

      const body1 = {
        reference: "CMD-IDEMP-01",
        recipient_name: "Koffi",
        recipient_phone: "07 72 00 00 01",
        address: "Cocody",
      };
      const rawBody1 = JSON.stringify(body1);

      const first = await handleV1CreateDelivery(tx, apiKey, body1, {
        idempotencyKey: "req-12345",
        rawBody: rawBody1,
      });
      expect(first.status).toBe(201);
      expect(first.replayed).toBe(false);

      const second = await handleV1CreateDelivery(tx, apiKey, body1, {
        idempotencyKey: "req-12345",
        rawBody: rawBody1,
      });
      expect(second.status).toBe(201);
      expect(second.replayed).toBe(true);
      expect(second.body).toEqual(first.body);

      const rows = await tx
        .select()
        .from(deliveries)
        .where(eq(deliveries.companyId, admin.companyId));
      expect(rows).toHaveLength(1);

      // Même Idempotency-Key + corps différent -> 409 IDEMPOTENCY_KEY_CONFLICT
      const conflict = await handleV1CreateDelivery(
        tx,
        apiKey,
        { ...body1, reference: "CMD-IDEMP-02" },
        {
          idempotencyKey: "req-12345",
          rawBody: JSON.stringify({ ...body1, reference: "CMD-IDEMP-02" }),
        },
      );
      expect(conflict.status).toBe(409);
      expect((conflict.body.error as { code: string }).code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    });
  });
});
