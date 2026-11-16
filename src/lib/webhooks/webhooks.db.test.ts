import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { companies, userRoles, users, webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import { authenticateApiKey, createApiKey } from "@/lib/api-keys/api-keys";
import { handleV1CreateDelivery, handleV1SimulateDelivery } from "@/lib/api-keys/v1-handlers";
import type { CompanyUserIdentity, UserRole } from "@/lib/auth/company-user";
import { decryptSecret } from "@/lib/security";
import { tenantScope } from "@/lib/tenant/scope";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  processPendingWebhooks,
  retryWebhookDelivery,
  sendTestWebhook,
  toggleWebhookEndpoint,
  verifyWebhookSignature,
  WebhookError,
} from "./webhooks";

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
const MASTER_KEY = Buffer.alloc(32, 9);

async function twoCompanies(tx: Executor): Promise<{ a: CompanyUserIdentity; b: CompanyUserIdentity }> {
  const [cA, cB] = await tx
    .insert(companies)
    .values([
      { name: "Alpha Hook", slug: `alpha-hook-${uid()}` },
      { name: "Beta Hook", slug: `beta-hook-${uid()}` },
    ])
    .returning();
  const now = new Date();
  const [uA, uB] = await tx
    .insert(users)
    .values([
      { companyId: cA.id, name: "Admin A", email: `ha.${uid()}@ex.ci`, activatedAt: now, isActive: true },
      { companyId: cB.id, name: "Admin B", email: `hb.${uid()}@ex.ci`, activatedAt: now, isActive: true },
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

async function member(tx: Executor, admin: CompanyUserIdentity, roles: UserRole[]): Promise<CompanyUserIdentity> {
  const [user] = await tenantScope(tx, admin.companyId).insert(users, {
    name: "Membre",
    email: `hm.${uid()}@ex.ci`,
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

async function expectWebhookError(p: Promise<unknown>, code: WebhookError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(WebhookError);
  expect((err as WebhookError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("webhooks test et production + file d'envoi signée HMAC + backoff (6.6 & 6.7)", () => {
  it("sépare TEST/LIVE, émet les événements avec reference & metadata signés HMAC et gère le backoff jusqu'à FAILED", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);

      const testHook = await createWebhookEndpoint(
        tx,
        a,
        {
          url: "https://sandbox.boutique.ci/ofika-webhook",
          environment: "TEST",
          events: ["delivery.created", "delivery.delivered"],
        },
        MASTER_KEY,
      );
      const liveHook = await createWebhookEndpoint(
        tx,
        a,
        {
          url: "https://prod.boutique.ci/ofika-webhook",
          environment: "LIVE",
          events: ["delivery.created", "delivery.delivered"],
        },
        MASTER_KEY,
      );

      // Secret chiffré AES-256-GCM en base (pas en clair)
      const [dbHookRow] = await tenantScope(tx, a.companyId).selectAll(
        webhookEndpoints,
        eq(webhookEndpoints.id, testHook.endpoint.id),
      );
      expect(dbHookRow.secretEncrypted).toMatch(/^v1\./);
      expect(dbHookRow.secretEncrypted).not.toContain(testHook.secret);
      expect(decryptSecret(dbHookRow.secretEncrypted, MASTER_KEY, testHook.endpoint.id)).toBe(testHook.secret);

      // Clé TEST -> crée et simule une livraison TEST -> seul testHook reçoit les événements
      const testApiKeyCreated = await createApiKey(tx, a, { name: "Test Hook Key", environment: "TEST" });
      const authTest = await authenticateApiKey(tx, testApiKeyCreated.secretKey);
      if (!authTest.ok) throw new Error("auth failed");

      const created = await handleV1CreateDelivery(tx, authTest.apiKey, {
        reference: "CMD-HOOK-01",
        recipient_name: "Awa",
        recipient_phone: "07 80 00 00 01",
        address: "Cocody",
        metadata: { order_id: 777, shop: "abidjan" },
      });
      const deliveryId = String((created.body.data as { id: string }).id);
      await handleV1SimulateDelivery(tx, authTest.apiKey, deliveryId, { status: "DELIVERED" });

      const testQueue = await tx
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.endpointId, testHook.endpoint.id));
      const liveQueue = await tx
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.endpointId, liveHook.endpoint.id));

      expect(testQueue.map((q) => q.eventType).sort()).toEqual(["delivery.created", "delivery.delivered"]);
      expect(liveQueue).toHaveLength(0);

      // Expédition signée HMAC vérifiable
      const captured: Array<{ url: string; sig: string | null; body: string; event: string | null }> = [];
      const t0 = new Date(Date.now() + 5_000);
      const okFetcher: typeof fetch = async (input, init) => {
        const headers = new Headers(init?.headers);
        captured.push({
          url: String(input),
          sig: headers.get("X-Ofika-Signature"),
          body: String(init?.body ?? ""),
          event: headers.get("X-Ofika-Event"),
        });
        return new Response("ok", { status: 200 });
      };

      const outcomes = await processPendingWebhooks(tx, {
        masterKey: MASTER_KEY,
        fetcher: okFetcher,
        now: t0,
      });
      expect(outcomes).toHaveLength(2);
      expect(outcomes.every((o) => o.status === "SUCCEEDED" && o.responseStatus === 200)).toBe(true);
      expect(captured).toHaveLength(2);

      for (const req of captured) {
        expect(req.url).toBe("https://sandbox.boutique.ci/ofika-webhook");
        expect(
          verifyWebhookSignature(req.body, req.sig, testHook.secret, {
            nowSec: Math.floor(t0.getTime() / 1000),
          }),
        ).toBe(true);
        const parsed = JSON.parse(req.body) as {
          livemode: boolean;
          data: { reference: string; metadata: { order_id: number } };
        };
        expect(parsed.livemode).toBe(false);
        expect(parsed.data.reference).toBe("CMD-HOOK-01");
        expect(parsed.data.metadata).toEqual({ order_id: 777, shop: "abidjan" });
      }

      // Backoff croissant sur échecs HTTP 500 : 1min -> 5min -> 30min -> 2h -> FAILED au 5e essai
      const liveKeyCreated = await createApiKey(tx, a, { name: "Live Hook Key", environment: "LIVE" });
      const authLive = await authenticateApiKey(tx, liveKeyCreated.secretKey);
      if (!authLive.ok) throw new Error("auth live failed");

      await handleV1CreateDelivery(tx, authLive.apiKey, {
        reference: "CMD-HOOK-LIVE",
        recipient_name: "Yao",
        recipient_phone: "07 80 00 00 02",
        address: "Marcory",
      });

      const failFetcher: typeof fetch = async () => new Response("Server down", { status: 500 });
      const stepsSec = [0, 60, 300, 1800, 7200];
      let curTime = Date.now() + 5_000;

      for (let i = 0; i < stepsSec.length; i++) {
        if (i > 0) {
          // Avant l'échéance : aucun envoi traité
          const tooEarly = await processPendingWebhooks(tx, {
            masterKey: MASTER_KEY,
            fetcher: failFetcher,
            now: new Date(curTime + (stepsSec[i] - 5) * 1000),
          });
          expect(tooEarly).toHaveLength(0);
          curTime += stepsSec[i] * 1000;
        }
        const res = await processPendingWebhooks(tx, {
          masterKey: MASTER_KEY,
          fetcher: failFetcher,
          now: new Date(curTime),
        });
        expect(res).toHaveLength(1);
        expect(res[0].status).toBe(i === stepsSec.length - 1 ? "FAILED" : "PENDING");
      }

      const [failedRow] = await tx
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.endpointId, liveHook.endpoint.id));
      expect(failedRow.attemptCount).toBe(5);
      expect(failedRow.status).toBe("FAILED");
      expect(failedRow.lastResponseStatus).toBe(500);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});

describe("webhook de test, historique, renvoi et droits (6.8 & 6.9)", () => {
  it("envoie webhook.test avec réponse/erreur, permet Renvoyer et isole les entreprises", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const mgr = await member(tx, a, ["MANAGER"]);

      await expectWebhookError(
        createWebhookEndpoint(
          tx,
          mgr,
          { url: "https://example.com/hook", environment: "TEST", events: ["delivery.created"] },
          MASTER_KEY,
        ),
        "FORBIDDEN",
      );

      const created = await createWebhookEndpoint(
        tx,
        a,
        { url: "https://example.com/hook", environment: "LIVE", events: ["delivery.delivered"] },
        MASTER_KEY,
      );

      expect(await listWebhookEndpoints(tx, a)).toHaveLength(1);
      expect(await listWebhookEndpoints(tx, b)).toEqual([]);
      await expectWebhookError(toggleWebhookEndpoint(tx, b, created.endpoint.id, false), "NOT_FOUND");

      // Webhook de test en échec HTTP 503 puis Renvoyer -> 200 OK
      const testFail = await sendTestWebhook(tx, a, created.endpoint.id, {
        masterKey: MASTER_KEY,
        fetcher: async () => new Response("Unavailable", { status: 503 }),
      });
      expect(testFail.status).toBe("PENDING");
      expect(testFail.responseStatus).toBe(503);
      expect(testFail.error).toContain("503");

      const history = await listWebhookDeliveries(tx, a);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: testFail.webhookDeliveryId,
        eventType: "webhook.test",
        reference: "CMD-TEST-WEBHOOK",
        lastResponseStatus: 503,
      });

      // Cloisonnement renvoi entre entreprises
      await expectWebhookError(
        retryWebhookDelivery(tx, b, testFail.webhookDeliveryId, {
          masterKey: MASTER_KEY,
          fetcher: async () => new Response("ok", { status: 200 }),
        }),
        "NOT_FOUND",
      );

      const retried = await retryWebhookDelivery(tx, a, testFail.webhookDeliveryId, {
        masterKey: MASTER_KEY,
        fetcher: async () => new Response("ok", { status: 200 }),
      });
      expect(retried.status).toBe("SUCCEEDED");
      expect(retried.responseStatus).toBe(200);

      // Activation/désactivation + suppression propre avec historique
      const disabled = await toggleWebhookEndpoint(tx, a, created.endpoint.id, false);
      expect(disabled.isActive).toBe(false);
      await deleteWebhookEndpoint(tx, a, created.endpoint.id);
      expect(await listWebhookEndpoints(tx, a)).toEqual([]);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});
