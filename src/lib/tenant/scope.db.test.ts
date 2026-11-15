// Critère de la tâche 1.6 : « l'entreprise A ne voit rien de l'entreprise B ».
// Deux entreprises complètes sur la base `dev`, transaction annulée.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { apiKeys, companies, companyCouriers, couriers, deliveries, deliveryAttempts, webhookEndpoints } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { encryptSecret, generateApiKey, randomToken } from "@/lib/security";
import { TENANT_TABLES, tenantScope } from "./scope";

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
const KEY = Buffer.alloc(32, 7);

/** Une entreprise avec : admin, livreur rattaché, livraison + tentative, clé API, webhook, événement d'audit. */
async function fullCompany(tx: Executor, paId: string, name: string) {
  const c = await createCompanyWithAdmin(tx, { companyName: name, adminName: `Admin ${name}`, adminEmail: `a.${uid()}@ex.ci` }, paId);
  if (!c.ok) throw new Error("création");
  const scope = tenantScope(tx, c.company.id);

  const [courier] = await tx.insert(couriers).values({ name: `Livreur ${name}`, phone: `+t-${uid()}` }).returning();
  await scope.insert(companyCouriers, { courierId: courier.id, employmentType: "EMPLOYEE" });

  const [delivery] = await scope.insert(deliveries, {
    reference: `CMD-${name}`,
    recipientName: `Client ${name}`,
    recipientPhone: "+2250700000000",
    address: `Adresse ${name}`,
    courierId: courier.id,
    status: "ASSIGNED",
  });
  await tx.insert(deliveryAttempts).values({ deliveryId: delivery.id, courierId: courier.id, attemptNumber: 1 });

  const key = generateApiKey("TEST");
  await scope.insert(apiKeys, { name: "Site", prefix: key.prefix, keyHash: key.hash, environment: "TEST", createdByUserId: c.admin.id });
  await scope.insert(webhookEndpoints, {
    url: `https://${name.toLowerCase()}.example/webhook`,
    environment: "TEST",
    secretEncrypted: encryptSecret(randomToken(), KEY),
    events: ["delivery.delivered"],
  });
  await logEvent(tx, { companyId: c.company.id, eventType: "TEST_EVENT", actorType: "SYSTEM", payload: { name } });

  return { companyId: c.company.id, adminId: c.admin.id, deliveryId: delivery.id, courierId: courier.id };
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("cloisonnement par entreprise (base réelle)", () => {
  it("l'entreprise A ne voit rien de l'entreprise B, sur chaque table d'entreprise", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const A = await fullCompany(tx, pa.id, "Alpha");
      const B = await fullCompany(tx, pa.id, "Beta");
      const scopeA = tenantScope(tx, A.companyId);

      for (const [name, table] of Object.entries(TENANT_TABLES)) {
        const rows = (await scopeA.selectAll(table)) as { companyId: string | null }[];
        expect(
          rows.every((r) => r.companyId === A.companyId),
          `${name} : une ligne d'une autre entreprise est visible`,
        ).toBe(true);
      }

      // Et A voit bien ses propres données (le filtre ne vide pas tout)
      expect((await scopeA.selectAll(deliveries)).map((d) => d.id)).toEqual([A.deliveryId]);
      expect(await scopeA.selectAll(apiKeys)).toHaveLength(1);
      expect(await scopeA.selectAll(webhookEndpoints)).toHaveLength(1);
      expect((await scopeA.selectAll(companyCouriers)).map((c) => c.courierId)).toEqual([A.courierId]);
    });
  });

  it("tables rattachées à une livraison : A ne voit pas les tentatives de B", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const A = await fullCompany(tx, pa.id, "Alpha");
      const B = await fullCompany(tx, pa.id, "Beta");
      const attempts = await tx.select().from(deliveryAttempts).where(tenantScope(tx, A.companyId).ofOwnDelivery(deliveryAttempts.deliveryId));
      expect(attempts.map((a) => a.deliveryId)).toEqual([A.deliveryId]);
      expect(attempts.some((a) => a.deliveryId === B.deliveryId)).toBe(false);
    });
  });

  it("A ne peut ni lire ni modifier une livraison de B, même en connaissant son identifiant", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const A = await fullCompany(tx, pa.id, "Alpha");
      const B = await fullCompany(tx, pa.id, "Beta");
      const scopeA = tenantScope(tx, A.companyId);

      expect(await scopeA.selectAll(deliveries, eq(deliveries.id, B.deliveryId))).toEqual([]);
      expect(await scopeA.update(deliveries, { comment: "piraté" }, eq(deliveries.id, B.deliveryId))).toEqual([]);

      const [b] = await tx.select().from(deliveries).where(eq(deliveries.id, B.deliveryId));
      expect(b.comment).toBeNull();
    });
  });

  it("une insertion est toujours rattachée à l'entreprise du scope, même si on en force une autre", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const A = await fullCompany(tx, pa.id, "Alpha");
      const B = await fullCompany(tx, pa.id, "Beta");
      const scopeA = tenantScope(tx, A.companyId);

      const [row] = await scopeA.insert(deliveries, {
        companyId: B.companyId, // tentative de détournement
        reference: "CMD-FORCE",
        recipientName: "X",
        recipientPhone: "+2250700000001",
        address: "Y",
      } as never);
      expect(row.companyId).toBe(A.companyId);

      // Et une mise à jour ne peut pas déplacer une ligne vers B
      const [moved] = await scopeA.update(deliveries, { companyId: B.companyId, comment: "ok" } as never, eq(deliveries.id, A.deliveryId));
      expect(moved.companyId).toBe(A.companyId);
      expect(moved.comment).toBe("ok");
    });
  });

  it("refuse un scope sans entreprise", () => {
    expect(() => tenantScope(db, "")).toThrow();
  });

  it("une entreprise inconnue ne voit rien", async () => {
    await inRolledBackTx(async (tx) => {
      const [ghost] = await tx.insert(companies).values({ name: "Vide", slug: `vide-${uid()}` }).returning();
      expect(await tenantScope(tx, ghost.id).selectAll(deliveries)).toEqual([]);
    });
  });
});
