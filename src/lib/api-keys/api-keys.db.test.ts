import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { apiKeys, auditEvents, companies, userRoles, users } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity, UserRole } from "@/lib/auth/company-user";
import { tenantScope } from "@/lib/tenant/scope";
import {
  ApiKeyError,
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "./api-keys";

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

async function twoCompanies(tx: Executor): Promise<{ a: CompanyUserIdentity; b: CompanyUserIdentity }> {
  const [cA, cB] = await tx
    .insert(companies)
    .values([
      { name: "Alpha API", slug: `alpha-api-${uid()}` },
      { name: "Beta API", slug: `beta-api-${uid()}` },
    ])
    .returning();
  const now = new Date();
  const [uA, uB] = await tx
    .insert(users)
    .values([
      { companyId: cA.id, name: "Admin A", email: `aa.${uid()}@ex.ci`, activatedAt: now, isActive: true },
      { companyId: cB.id, name: "Admin B", email: `ab.${uid()}@ex.ci`, activatedAt: now, isActive: true },
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
    email: `m.${uid()}@ex.ci`,
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

async function expectApiKeyError(p: Promise<unknown>, code: ApiKeyError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(ApiKeyError);
  expect((err as ApiKeyError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("clés API test et production (6.1)", () => {
  it("crée des clés TEST et LIVE hachées, les liste sans hash et authentifie via Bearer", async () => {
    await inRolledBackTx(async (tx) => {
      const { a } = await twoCompanies(tx);

      const testCreated = await createApiKey(
        tx,
        a,
        { name: "Sandbox Boutique", environment: "TEST" },
        { ip: "203.0.113.10", userAgent: "vitest" },
      );
      expect(testCreated.secretKey.startsWith("ofk_test_")).toBe(true);
      expect(testCreated.apiKey.prefix).toBe(testCreated.secretKey.slice(0, 13));
      expect(testCreated.apiKey.environment).toBe("TEST");
      expect(testCreated.apiKey.revokedAt).toBeNull();
      expect("keyHash" in testCreated.apiKey).toBe(false);

      const liveCreated = await createApiKey(tx, a, {
        name: "Production ERP",
        environment: "LIVE",
      });
      expect(liveCreated.secretKey.startsWith("ofk_live_")).toBe(true);
      expect(liveCreated.apiKey.prefix).toBe(liveCreated.secretKey.slice(0, 13));

      // Stockage haché uniquement en base + audit sans secret
      const [dbTestRow] = await tenantScope(tx, a.companyId).selectAll(
        apiKeys,
        eq(apiKeys.id, testCreated.apiKey.id),
      );
      expect(dbTestRow.keyHash).not.toBe(testCreated.secretKey);
      expect(dbTestRow.keyHash).toHaveLength(64);

      const auditRows = await tenantScope(tx, a.companyId).selectAll(apiKeys);
      expect(auditRows).toHaveLength(2);
      const events = await tenantScope(tx, a.companyId).selectAll(auditEvents);
      expect(events.map((e) => e.eventType)).toEqual(["API_KEY_CREATED", "API_KEY_CREATED"]);
      expect(JSON.stringify(events)).not.toContain(testCreated.secretKey);
      expect(JSON.stringify(events)).not.toContain(liveCreated.secretKey);

      // Liste sans exposer keyHash
      const listed = await listApiKeys(tx, a);
      expect(listed).toHaveLength(2);
      expect(listed.every((k) => !("keyHash" in k))).toBe(true);

      // Authentification par clé brute et par en-tête Bearer + mise à jour lastUsedAt
      const authTest = await authenticateApiKey(tx, `Bearer ${testCreated.secretKey}`);
      expect(authTest).toMatchObject({
        ok: true,
        apiKey: {
          id: testCreated.apiKey.id,
          companyId: a.companyId,
          environment: "TEST",
          isTest: true,
          livemode: false,
        },
      });

      const authLive = await authenticateApiKey(tx, liveCreated.secretKey);
      expect(authLive).toMatchObject({
        ok: true,
        apiKey: {
          id: liveCreated.apiKey.id,
          companyId: a.companyId,
          environment: "LIVE",
          isTest: false,
          livemode: true,
        },
      });

      const listedAfterUse = await listApiKeys(tx, a);
      expect(listedAfterUse.every((k) => k.lastUsedAt !== null)).toBe(true);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("refuse immédiatement une clé révoquée ou une entreprise suspendue, cloisonne et limite aux admins", async () => {
    await inRolledBackTx(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      const mgr = await member(tx, a, ["MANAGER"]);
      const ret = await member(tx, a, ["RETURNS_OFFICER"]);

      // MANAGER et RETURNS_OFFICER refusés
      await expectApiKeyError(createApiKey(tx, mgr, { name: "Test", environment: "TEST" }), "FORBIDDEN");
      await expectApiKeyError(createApiKey(tx, ret, { name: "Test", environment: "TEST" }), "FORBIDDEN");
      await expectApiKeyError(listApiKeys(tx, mgr), "FORBIDDEN");

      const created = await createApiKey(tx, a, { name: "Clé à révoquer", environment: "LIVE" });

      // Cloisonnement : entreprise B ne voit ni ne révoque la clé de A
      expect(await listApiKeys(tx, b)).toEqual([]);
      await expectApiKeyError(revokeApiKey(tx, b, created.apiKey.id), "NOT_FOUND");
      await expectApiKeyError(revokeApiKey(tx, a, "not-a-uuid"), "NOT_FOUND");

      // Révocation par admin A -> authentification refusée immédiatement
      const revoked = await revokeApiKey(tx, a, created.apiKey.id);
      expect(revoked.alreadyRevoked).toBe(false);
      expect(revoked.apiKey.revokedAt).not.toBeNull();

      // Double révocation idempotente
      const revokedAgain = await revokeApiKey(tx, a, created.apiKey.id);
      expect(revokedAgain.alreadyRevoked).toBe(true);

      expect(await authenticateApiKey(tx, `Bearer ${created.secretKey}`)).toEqual({
        ok: false,
        error: "REVOKED_KEY",
      });
      expect(await authenticateApiKey(tx, "ofk_test_inconnue_123456")).toEqual({
        ok: false,
        error: "INVALID_KEY",
      });
      expect(await authenticateApiKey(tx, "not_a_key")).toEqual({
        ok: false,
        error: "INVALID_KEY",
      });

      // Entreprise suspendue refusée même avec clé active
      const activeKey = await createApiKey(tx, a, { name: "Clé active", environment: "TEST" });
      await tx.update(companies).set({ status: "SUSPENDED" }).where(eq(companies.id, a.companyId));
      expect(await authenticateApiKey(tx, activeKey.secretKey)).toEqual({
        ok: false,
        error: "COMPANY_SUSPENDED",
      });

      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });
});
