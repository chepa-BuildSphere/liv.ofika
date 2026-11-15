// Création d'entreprise + activation du premier admin, sur la base `dev`, transaction annulée.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents, userAccessTokens, userRoles, users } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import { activateAccount, findActivation } from "@/lib/auth/activation";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { verifySecret } from "@/lib/security";
import { createCompanyWithAdmin, regenerateActivationLink } from "./create-company";

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

const PASSWORD = "mon-mot-de-passe-solide";

async function setup(tx: Executor, email = `awa.${crypto.randomUUID()}@exemple.ci`) {
  const platformAdmin = await createPlatformAdmin(tx, {
    email: `pa.${crypto.randomUUID()}@ofika.test`,
    name: "PA",
    password: "mot-de-passe-plateforme",
  });
  const created = await createCompanyWithAdmin(
    tx,
    { companyName: "Chez Awa", adminName: "Awa Koné", adminEmail: email, adminPhone: "+225 07 00 00 00 00" },
    platformAdmin.id,
  );
  if (!created.ok) throw new Error(JSON.stringify(created.errors));
  return { platformAdmin, created };
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("création d'entreprise + premier admin (base réelle)", () => {
  it("crée l'entreprise, l'admin (rôle COMPANY_ADMIN, sans mot de passe) et un lien", async () => {
    await inRolledBackTx(async (tx) => {
      const { created } = await setup(tx);
      if (!created.ok) return;

      const [user] = await tx.select().from(users).where(eq(users.id, created.admin.id));
      expect(user.companyId).toBe(created.company.id);
      expect(user.passwordHash).toBeNull();
      expect(user.activatedAt).toBeNull();

      const roles = await tx.select().from(userRoles).where(eq(userRoles.userId, user.id));
      expect(roles.map((r) => r.role)).toEqual(["COMPANY_ADMIN"]);

      const [token] = await tx.select().from(userAccessTokens).where(eq(userAccessTokens.userId, user.id));
      expect(token.tokenHash).not.toContain(created.activationToken); // seule l'empreinte est stockée

      const events = await tx.select({ t: auditEvents.eventType }).from(auditEvents).where(eq(auditEvents.companyId, created.company.id));
      expect(events.map((e) => e.t)).toEqual(["COMPANY_CREATED", "USER_INVITED"]);
    });
  });

  it("donne un identifiant unique à deux entreprises de même nom", async () => {
    await inRolledBackTx(async (tx) => {
      const { platformAdmin, created } = await setup(tx);
      const second = await createCompanyWithAdmin(
        tx,
        { companyName: "Chez Awa", adminName: "Autre", adminEmail: `autre.${crypto.randomUUID()}@exemple.ci` },
        platformAdmin.id,
      );
      expect(created.ok && second.ok).toBe(true);
      if (created.ok && second.ok) expect(second.company.slug).not.toBe(created.company.slug);
    });
  });

  it("refuse un e-mail déjà utilisé", async () => {
    await inRolledBackTx(async (tx) => {
      const email = `doublon.${crypto.randomUUID()}@exemple.ci`;
      const { platformAdmin } = await setup(tx, email);
      const again = await createCompanyWithAdmin(
        tx,
        { companyName: "Autre", adminName: "Autre", adminEmail: email.toUpperCase() },
        platformAdmin.id,
      );
      expect(again).toEqual({ ok: false, errors: { adminEmail: "Cet e-mail est déjà utilisé par un autre compte." } });
    });
  });

  it("l'admin entreprise active son compte avec le lien : il reçoit ses accès", async () => {
    await inRolledBackTx(async (tx) => {
      const { created } = await setup(tx);
      if (!created.ok) return;
      const token = created.activationToken;

      const info = await findActivation(tx, token);
      expect(info).toMatchObject({ ok: true, companyName: "Chez Awa", user: { name: "Awa Koné" } });

      expect(await activateAccount(tx, token, "court", "court")).toEqual({ ok: false, problem: "WEAK_PASSWORD" });
      expect(await activateAccount(tx, token, PASSWORD, PASSWORD + "x")).toEqual({ ok: false, problem: "MISMATCH" });

      const done = await activateAccount(tx, token, PASSWORD, PASSWORD, { ip: "203.0.113.9" });
      expect(done).toMatchObject({ ok: true, userId: created.admin.id });

      const [user] = await tx.select().from(users).where(eq(users.id, created.admin.id));
      expect(user.activatedAt).toBeInstanceOf(Date);
      expect(await verifySecret(PASSWORD, user.passwordHash!)).toBe(true);

      // Usage unique
      expect(await activateAccount(tx, token, PASSWORD, PASSWORD)).toEqual({ ok: false, problem: "USED" });
      expect(await findActivation(tx, token)).toEqual({ ok: false, problem: "USED" });

      const [ev] = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.eventType, "USER_ACTIVATED"), eq(auditEvents.actorId, created.admin.id)));
      expect(ev).toMatchObject({ actorId: created.admin.id, companyId: created.company.id });
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("un nouveau lien remplace l'ancien", async () => {
    await inRolledBackTx(async (tx) => {
      const { platformAdmin, created } = await setup(tx);
      if (!created.ok) return;

      const fresh = await regenerateActivationLink(tx, created.admin.id, platformAdmin.id);
      if (!fresh.ok) throw new Error(fresh.error);

      expect(await findActivation(tx, created.activationToken)).toEqual({ ok: false, problem: "INVALID" });
      expect((await findActivation(tx, fresh.token)).ok).toBe(true);
    });
  });

  it("refuse un lien expiré et un jeton inventé", async () => {
    await inRolledBackTx(async (tx) => {
      const { created } = await setup(tx);
      if (!created.ok) return;
      await tx
        .update(userAccessTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(userAccessTokens.userId, created.admin.id));

      expect(await activateAccount(tx, created.activationToken, PASSWORD, PASSWORD)).toEqual({ ok: false, problem: "EXPIRED" });
      expect(await findActivation(tx, "jeton-invente")).toEqual({ ok: false, problem: "INVALID" });
    });
  });

  it("refuse de régénérer un lien pour un compte déjà activé", async () => {
    await inRolledBackTx(async (tx) => {
      const { platformAdmin, created } = await setup(tx);
      if (!created.ok) return;
      await activateAccount(tx, created.activationToken, PASSWORD, PASSWORD);
      expect(await regenerateActivationLink(tx, created.admin.id, platformAdmin.id)).toEqual({
        ok: false,
        error: "Ce compte est déjà activé.",
      });
    });
  });
});
