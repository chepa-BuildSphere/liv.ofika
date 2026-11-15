// Règle 9 : consultation support journalisée et visible par l'entreprise.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { auditEvents } from "@/db/schema";
import { verifyAuditChain, type Executor } from "@/lib/audit";
import { activateAccount } from "@/lib/auth/activation";
import { loginCompanyUser, type CompanyUserIdentity } from "@/lib/auth/company-user";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { inviteUser } from "@/lib/team/team";
import { listSupportViews, logSupportView, SUPPORT_VIEW } from "./support-view";

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
const PASSWORD = "mot-de-passe-support";

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

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
afterAll(async () => {
  await pool.end();
});

describe("consultations du support (base réelle)", () => {
  it("la consultation est journalisée dans l'audit de l'entreprise consultée", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "Toto Support", password: "mot-de-passe-plateforme" });
      const admin = await companyAdmin(tx, pa.id, "Alpha");

      expect(await logSupportView(tx, { platformAdmin: pa, companyId: admin.companyId, view: "company_detail", ip: "203.0.113.5" })).toEqual({ logged: true });

      const events = await tx
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.companyId, admin.companyId), eq(auditEvents.eventType, SUPPORT_VIEW)));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ actorType: "PLATFORM_ADMIN", actorId: pa.id, ip: "203.0.113.5" });
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it("l'admin entreprise voit la consultation (qui, quoi, quand)", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "Toto Support", password: "mot-de-passe-plateforme" });
      const admin = await companyAdmin(tx, pa.id, "Alpha");
      await logSupportView(tx, { platformAdmin: pa, companyId: admin.companyId, view: "company_detail" });

      const views = await listSupportViews(tx, admin);
      expect(views).toHaveLength(1);
      expect(views![0]).toMatchObject({ adminName: "Toto Support", what: "Fiche de l'entreprise et liste des utilisateurs" });
      expect(views![0].at).toBeInstanceOf(Date);
    });
  });

  it("recharger la page dans les 5 minutes ne crée pas de doublon", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const admin = await companyAdmin(tx, pa.id, "Alpha");
      await logSupportView(tx, { platformAdmin: pa, companyId: admin.companyId, view: "company_detail" });
      expect(await logSupportView(tx, { platformAdmin: pa, companyId: admin.companyId, view: "company_detail" })).toEqual({ logged: false });
      expect(await listSupportViews(tx, admin)).toHaveLength(1);
    });
  });

  it("une autre entreprise ne voit pas ces consultations", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const alpha = await companyAdmin(tx, pa.id, "Alpha");
      const beta = await companyAdmin(tx, pa.id, "Beta");
      await logSupportView(tx, { platformAdmin: pa, companyId: alpha.companyId, view: "company_detail" });
      expect(await listSupportViews(tx, beta)).toEqual([]);
    });
  });

  it("selon la matrice : le gestionnaire voit, le responsable retours non", async () => {
    await inRolledBackTx(async (tx) => {
      const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
      const admin = await companyAdmin(tx, pa.id, "Alpha");
      await logSupportView(tx, { platformAdmin: pa, companyId: admin.companyId, view: "company_detail" });

      expect(await listSupportViews(tx, await member(tx, admin, ["MANAGER"]))).toHaveLength(1);
      expect(await listSupportViews(tx, await member(tx, admin, ["RETURNS_OFFICER"]))).toBeNull();
    });
  });
});
