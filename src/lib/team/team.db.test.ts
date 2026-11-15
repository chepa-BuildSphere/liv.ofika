// Gestion de l'équipe par l'admin entreprise, sur la base `dev`, transaction annulée.
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { sessions, userAccessTokens } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { activateAccount } from "@/lib/auth/activation";
import { getCompanyUserBySession, loginCompanyUser, type CompanyUserIdentity } from "@/lib/auth/company-user";
import { resetThrottle } from "@/lib/auth/login-throttle";
import { createPlatformAdmin } from "@/lib/auth/platform-admin";
import { createCompanyWithAdmin } from "@/lib/companies/create-company";
import { inviteUser, listTeam, regenerateTeamLink, setUserActive, TeamError, updateUserRoles } from "./team";

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

const PASSWORD = "mot-de-passe-equipe";
const uid = () => crypto.randomUUID();

/** Entreprise avec son admin activé et connecté ; renvoie l'identité de l'admin. */
async function companyWithAdmin(tx: Executor, name = "Chez Awa"): Promise<CompanyUserIdentity> {
  const pa = await createPlatformAdmin(tx, { email: `pa.${uid()}@ofika.test`, name: "PA", password: "mot-de-passe-plateforme" });
  const email = `admin.${uid()}@exemple.ci`;
  const c = await createCompanyWithAdmin(tx, { companyName: name, adminName: "Awa Koné", adminEmail: email }, pa.id);
  if (!c.ok) throw new Error("création");
  await activateAccount(tx, c.activationToken, PASSWORD, PASSWORD);
  const r = await loginCompanyUser(tx, email, PASSWORD);
  if (!r.ok) throw new Error("login admin");
  return r.user;
}

/** Invite puis active un membre ; renvoie son identité de connexion. */
async function member(tx: Executor, admin: CompanyUserIdentity, roles: string[]) {
  const email = `membre.${uid()}@exemple.ci`;
  const inv = await inviteUser(tx, admin, { name: "Kofi", email, roles });
  await activateAccount(tx, inv.token, PASSWORD, PASSWORD);
  const r = await loginCompanyUser(tx, email, PASSWORD);
  if (!r.ok) throw new Error("login membre");
  return { ...r.user, token: r.token };
}

async function expectTeamError(p: Promise<unknown>, code: TeamError["code"]) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(TeamError);
  expect((err as TeamError).code).toBe(code);
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") throw new Error("Tests base interdits sur production");
});
beforeEach(() => resetThrottle());
afterAll(async () => {
  await pool.end();
});

describe("équipe d'une entreprise (base réelle)", () => {
  it("un utilisateur peut être gestionnaire ET responsable retours", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      const m = await member(tx, admin, ["MANAGER", "RETURNS_OFFICER"]);

      expect(m.roles.sort()).toEqual(["MANAGER", "RETURNS_OFFICER"]);
      expect(m.companyId).toBe(admin.companyId);

      const team = await listTeam(tx, admin);
      expect(team.map((x) => x.name)).toEqual(["Awa Koné", "Kofi"]);
      expect(team[1].roles).toEqual(["MANAGER", "RETURNS_OFFICER"]);
    });
  });

  it("refuse une invitation sans rôle, avec un rôle inventé seul, ou un e-mail déjà pris", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      await expectTeamError(inviteUser(tx, admin, { name: "X Y", email: `a.${uid()}@ex.ci`, roles: [] }), "INVALID");
      await expectTeamError(inviteUser(tx, admin, { name: "X Y", email: `a.${uid()}@ex.ci`, roles: ["SUPER_ADMIN"] }), "INVALID");
      await expectTeamError(inviteUser(tx, admin, { name: "X Y", email: admin.email, roles: ["MANAGER"] }), "INVALID");
    });
  });

  it("seul l'admin entreprise gère l'équipe", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      const manager = await member(tx, admin, ["MANAGER"]);
      await expectTeamError(listTeam(tx, manager), "FORBIDDEN");
      await expectTeamError(inviteUser(tx, manager, { name: "X Y", email: `a.${uid()}@ex.ci`, roles: ["COMPANY_ADMIN"] }), "FORBIDDEN");
      await expectTeamError(updateUserRoles(tx, manager, manager.id, ["COMPANY_ADMIN"]), "FORBIDDEN");
    });
  });

  it("un admin ne touche jamais aux utilisateurs d'une autre entreprise", async () => {
    await inRolledBackTx(async (tx) => {
      const adminA = await companyWithAdmin(tx, "Entreprise A");
      const adminB = await companyWithAdmin(tx, "Entreprise B");
      const memberB = await member(tx, adminB, ["MANAGER"]);

      await expectTeamError(updateUserRoles(tx, adminA, memberB.id, ["COMPANY_ADMIN"]), "NOT_FOUND");
      await expectTeamError(setUserActive(tx, adminA, memberB.id, false), "NOT_FOUND");
      await expectTeamError(regenerateTeamLink(tx, adminA, memberB.id), "NOT_FOUND");
      expect((await listTeam(tx, adminA)).some((m) => m.id === memberB.id)).toBe(false);
    });
  });

  it("modifie les rôles d'un membre", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      const m = await member(tx, admin, ["MANAGER"]);
      await updateUserRoles(tx, admin, m.id, ["MANAGER", "RETURNS_OFFICER"]);
      expect((await getCompanyUserBySession(tx, m.token))?.roles.sort()).toEqual(["MANAGER", "RETURNS_OFFICER"]);
    });
  });

  it("l'entreprise garde toujours au moins un admin actif", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      await expectTeamError(updateUserRoles(tx, admin, admin.id, ["MANAGER"]), "LAST_ADMIN");

      // Avec un second admin, le premier peut quitter le rôle
      const second = await member(tx, admin, ["COMPANY_ADMIN"]);
      await updateUserRoles(tx, admin, admin.id, ["MANAGER"]);
      // … mais le second ne peut plus être désactivé ni rétrogradé
      const secondAsActor = (await getCompanyUserBySession(tx, second.token))!;
      await expectTeamError(updateUserRoles(tx, secondAsActor, second.id, ["MANAGER"]), "LAST_ADMIN");
    });
  });

  it("on ne se désactive pas soi-même", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      await expectTeamError(setUserActive(tx, admin, admin.id, false), "SELF");
    });
  });

  it("désactiver coupe immédiatement les sessions et les liens ; réactiver rend l'accès", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      const m = await member(tx, admin, ["MANAGER"]);
      const pending = await inviteUser(tx, admin, { name: "En attente", email: `p.${uid()}@ex.ci`, roles: ["MANAGER"] });

      await setUserActive(tx, admin, m.id, false);
      expect(await getCompanyUserBySession(tx, m.token)).toBeNull();
      const open = await tx.select().from(sessions).where(and(eq(sessions.userId, m.id), isNull(sessions.revokedAt)));
      expect(open).toHaveLength(0);
      expect(await loginCompanyUser(tx, m.email, PASSWORD)).toEqual({ ok: false, error: "INVALID" });

      await setUserActive(tx, admin, pending.user.id, false);
      const links = await tx
        .select()
        .from(userAccessTokens)
        .where(and(eq(userAccessTokens.userId, pending.user.id), isNull(userAccessTokens.revokedAt)));
      expect(links).toHaveLength(0);

      await setUserActive(tx, admin, m.id, true);
      expect((await loginCompanyUser(tx, m.email, PASSWORD)).ok).toBe(true);
    });
  });

  it("nouveau lien pour une invitation, refusé pour un compte déjà activé", async () => {
    await inRolledBackTx(async (tx) => {
      const admin = await companyWithAdmin(tx);
      const inv = await inviteUser(tx, admin, { name: "Kofi", email: `k.${uid()}@ex.ci`, roles: ["MANAGER"] });
      const fresh = await regenerateTeamLink(tx, admin, inv.user.id);
      expect(fresh.token).not.toBe(inv.token);
      expect((await activateAccount(tx, inv.token, PASSWORD, PASSWORD)).ok).toBe(false); // ancien lien révoqué
      expect((await activateAccount(tx, fresh.token, PASSWORD, PASSWORD)).ok).toBe(true);
      await expectTeamError(regenerateTeamLink(tx, admin, inv.user.id), "ALREADY_ACTIVE");
    });
  });
});
