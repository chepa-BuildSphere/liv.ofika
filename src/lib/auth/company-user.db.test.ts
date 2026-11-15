// Connexion des utilisateurs d'entreprise, sur la base `dev`, transaction annulée.
import { and, eq, gt, max } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents, companies, users } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { activateAccount } from "./activation";
import { getCompanyUserBySession, loginCompanyUser, logoutCompanyUser } from "./company-user";
import { resetThrottle } from "./login-throttle";
import { createPlatformAdmin } from "./platform-admin";

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

const PASSWORD = "mot-de-passe-entreprise";
const meta = { ip: "203.0.113.20", userAgent: "vitest" };

let auditBaseline = 0;
async function eventsOf(tx: Executor, type: string) {
  return tx.select().from(auditEvents).where(and(eq(auditEvents.eventType, type), gt(auditEvents.id, auditBaseline)));
}

/** Entreprise + admin ; activé avec PASSWORD si `activate`. */
async function seed(tx: Executor, activate = true) {
  const pa = await createPlatformAdmin(tx, { email: `pa.${crypto.randomUUID()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
  const email = `awa.${crypto.randomUUID()}@exemple.ci`;
  const created = await createCompanyWithAdmin(tx, { companyName: "Chez Awa", adminName: "Awa Koné", adminEmail: email }, pa.id);
  if (!created.ok) throw new Error("création");
  if (activate) await activateAccount(tx, created.activationToken, PASSWORD, PASSWORD);
  return { email, companyId: created.company.id, userId: created.admin.id };
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
beforeEach(async () => {
  resetThrottle();
  const [row] = await db.select({ max: max(auditEvents.id) }).from(auditEvents);
  auditBaseline = row.max ?? 0;
});
afterAll(async () => {
  await pool.end();
});

describe("connexion utilisateur d'entreprise (base réelle)", () => {
  it("connexion OK : identité, entreprise et rôles ; session valide", async () => {
    await inRolledBackTx(async (tx) => {
      const { email, companyId, userId } = await seed(tx);
      const r = await loginCompanyUser(tx, email.toUpperCase(), PASSWORD, meta);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.user).toMatchObject({ id: userId, companyId, companyName: "Chez Awa", roles: ["COMPANY_ADMIN"] });
      expect(await getCompanyUserBySession(tx, r.token)).toMatchObject({ id: userId, companyId });
      expect(await eventsOf(tx, "USER_LOGIN")).toHaveLength(1);
    });
  });

  it("déconnexion : la session ne marche plus", async () => {
    await inRolledBackTx(async (tx) => {
      const { email } = await seed(tx);
      const r = await loginCompanyUser(tx, email, PASSWORD, meta);
      if (!r.ok) throw new Error("login");
      await logoutCompanyUser(tx, r.token, meta);
      expect(await getCompanyUserBySession(tx, r.token)).toBeNull();
      expect(await eventsOf(tx, "USER_LOGOUT")).toHaveLength(1);
    });
  });

  it("compte pas encore activé : refusé comme un mauvais mot de passe", async () => {
    await inRolledBackTx(async (tx) => {
      const { email } = await seed(tx, false);
      expect(await loginCompanyUser(tx, email, PASSWORD, meta)).toEqual({ ok: false, error: "INVALID" });
      const [ev] = await eventsOf(tx, "USER_LOGIN_FAILED");
      expect(ev.payload).toMatchObject({ reason: "not_activated" });
    });
  });

  it("mauvais mot de passe et e-mail inconnu : même réponse", async () => {
    await inRolledBackTx(async (tx) => {
      const { email } = await seed(tx);
      expect(await loginCompanyUser(tx, email, "faux-mot-de-passe", meta)).toEqual({ ok: false, error: "INVALID" });
      expect(await loginCompanyUser(tx, "personne@exemple.ci", PASSWORD, meta)).toEqual({ ok: false, error: "INVALID" });
    });
  });

  it("bloqué après 5 échecs", async () => {
    await inRolledBackTx(async (tx) => {
      const { email } = await seed(tx);
      for (let i = 0; i < 5; i++) await loginCompanyUser(tx, email, "faux", meta);
      expect(await loginCompanyUser(tx, email, PASSWORD, meta)).toEqual({ ok: false, error: "LOCKED" });
    });
  });

  it("entreprise suspendue : connexion refusée et sessions en cours coupées", async () => {
    await inRolledBackTx(async (tx) => {
      const { email, companyId } = await seed(tx);
      const r = await loginCompanyUser(tx, email, PASSWORD, meta);
      if (!r.ok) throw new Error("login");

      await tx.update(companies).set({ status: "SUSPENDED" }).where(eq(companies.id, companyId));
      expect(await getCompanyUserBySession(tx, r.token)).toBeNull();
      expect(await loginCompanyUser(tx, email, PASSWORD, meta)).toEqual({ ok: false, error: "COMPANY_SUSPENDED" });
    });
  });

  it("utilisateur désactivé : sessions coupées", async () => {
    await inRolledBackTx(async (tx) => {
      const { email, userId } = await seed(tx);
      const r = await loginCompanyUser(tx, email, PASSWORD, meta);
      if (!r.ok) throw new Error("login");
      await tx.update(users).set({ isActive: false }).where(eq(users.id, userId));
      expect(await getCompanyUserBySession(tx, r.token)).toBeNull();
    });
  });

  it("une session admin plateforme n'ouvre pas l'espace entreprise", async () => {
    await inRolledBackTx(async (tx) => {
      const { loginPlatformAdmin } = await import("./platform-admin");
      const pa = await createPlatformAdmin(tx, { email: `pa2.${crypto.randomUUID()}@ofika.test`, name: "PA2", password: "mot-de-passe-plateforme" });
      const r = await loginPlatformAdmin(tx, pa.email, "mot-de-passe-plateforme", meta);
      if (!r.ok) throw new Error("login admin");
      expect(await getCompanyUserBySession(tx, r.token)).toBeNull();
    });
  });
});
