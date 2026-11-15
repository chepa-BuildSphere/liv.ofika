import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { companies, sessions, userAccessTokens, userRoles, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { issueActivationToken } from "@/lib/auth/activation";
import type { CompanyUserIdentity, UserRole } from "@/lib/auth/company-user";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { EMAIL_RE, PHONE_HINT, PHONE_RE } from "@/lib/validation";

// Gestion de l'équipe d'une entreprise par son admin (mvp.md §4.2 :
// « Gérer les utilisateurs de l'entreprise » = admin entreprise uniquement).
// Chaque fonction revérifie : l'acteur est admin, la cible est de SA entreprise.
// Une cible d'une autre entreprise est traitée comme introuvable (on ne
// révèle pas qu'elle existe).

export const ROLES: readonly UserRole[] = ["COMPANY_ADMIN", "MANAGER", "RETURNS_OFFICER"];

export type TeamErrorCode = "FORBIDDEN" | "NOT_FOUND" | "LAST_ADMIN" | "SELF" | "INVALID" | "ALREADY_ACTIVE";

export class TeamError extends Error {
  constructor(
    readonly code: TeamErrorCode,
    message: string,
    readonly fields?: Partial<Record<"name" | "email" | "phone" | "roles", string>>,
  ) {
    super(message);
    this.name = "TeamError";
  }
}

function assertAdmin(actor: CompanyUserIdentity) {
  if (!actor.roles.includes("COMPANY_ADMIN")) {
    throw new TeamError("FORBIDDEN", "Réservé à l'admin de l'entreprise.");
  }
}

function cleanRoles(input: string[]): UserRole[] {
  return [...new Set(input)].filter((r): r is UserRole => (ROLES as string[]).includes(r));
}

/** La cible, si elle appartient à l'entreprise de l'acteur ; sinon NOT_FOUND. */
async function loadTarget(db: Executor, actor: CompanyUserIdentity, userId: string) {
  const [target] = await db
    .select({ id: users.id, name: users.name, isActive: users.isActive, activatedAt: users.activatedAt })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.companyId, actor.companyId)))
    .limit(1)
    .for("update");
  if (!target) throw new TeamError("NOT_FOUND", "Utilisateur introuvable.");
  return target;
}

/**
 * Verrouille l'entreprise jusqu'à la fin de la transaction : deux admins qui se
 * retirent leur rôle en même temps passent l'un après l'autre, et le second
 * voit que le premier n'est plus admin (jamais zéro admin).
 */
async function lockCompany(db: Executor, companyId: string) {
  await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).for("update");
}

/** Nombre d'admins actifs de l'entreprise, hors `excludeUserId`. */
async function otherActiveAdmins(db: Executor, companyId: string, excludeUserId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY_ADMIN")))
    .where(and(eq(users.companyId, companyId), eq(users.isActive, true), ne(users.id, excludeUserId)));
  return rows.length;
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  isActive: boolean;
  activatedAt: Date | null;
  /** Lien d'activation encore valable (pour un compte pas encore activé). */
  pendingLinkExpiresAt: Date | null;
};

export async function listTeam(db: Executor, actor: CompanyUserIdentity): Promise<TeamMember[]> {
  assertAdmin(actor);
  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, isActive: users.isActive, activatedAt: users.activatedAt })
    .from(users)
    .where(eq(users.companyId, actor.companyId))
    .orderBy(users.createdAt);
  if (members.length === 0) return [];

  const ids = members.map((m) => m.id);
  const [roles, tokens] = await Promise.all([
    db.select().from(userRoles).where(inArray(userRoles.userId, ids)),
    db
      .select({ userId: userAccessTokens.userId, expiresAt: userAccessTokens.expiresAt })
      .from(userAccessTokens)
      .where(
        and(
          inArray(userAccessTokens.userId, ids),
          eq(userAccessTokens.purpose, "ACTIVATION"),
          isNull(userAccessTokens.usedAt),
          isNull(userAccessTokens.revokedAt),
        ),
      )
      .orderBy(desc(userAccessTokens.createdAt)),
  ]);
  const now = new Date();
  return members.map((m) => {
    const link = tokens.find((t) => t.userId === m.id && t.expiresAt > now);
    return {
      ...m,
      roles: ROLES.filter((r) => roles.some((x) => x.userId === m.id && x.role === r)),
      pendingLinkExpiresAt: m.activatedAt ? null : (link?.expiresAt ?? null),
    };
  });
}

// ─── Invitation ───────────────────────────────────────────────────────────────

export type InviteInput = { name: string; email: string; phone?: string; roles: string[] };

export async function inviteUser(db: Executor, actor: CompanyUserIdentity, input: InviteInput) {
  assertAdmin(actor);

  const fields: NonNullable<TeamError["fields"]> = {};
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() || null;
  const roles = cleanRoles(input.roles);
  if (name.length < 2 || name.length > 100) fields.name = "Entre 2 et 100 caractères.";
  if (!EMAIL_RE.test(email)) fields.email = "E-mail invalide.";
  if (phone && !PHONE_RE.test(phone)) fields.phone = PHONE_HINT;
  if (roles.length === 0) fields.roles = "Choisissez au moins un rôle.";
  if (Object.keys(fields).length) throw new TeamError("INVALID", "Formulaire incomplet.", fields);

  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (taken) throw new TeamError("INVALID", "Cet e-mail est déjà utilisé.", { email: "Cet e-mail est déjà utilisé par un autre compte." });

    const [user] = await tx
      .insert(users)
      .values({ companyId: actor.companyId, name, email, phone })
      .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone });
    await tx.insert(userRoles).values(roles.map((role) => ({ userId: user.id, role })));

    const { token, expiresAt } = await issueActivationToken(tx, user.id, { userId: actor.id });
    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "USER_INVITED",
      actorType: "USER",
      actorId: actor.id,
      payload: { userId: user.id, email, roles },
    });
    return { user, token, expiresAt };
  });
}

// ─── Rôles ────────────────────────────────────────────────────────────────────

export async function updateUserRoles(db: Executor, actor: CompanyUserIdentity, userId: string, rolesInput: string[]) {
  assertAdmin(actor);
  const roles = cleanRoles(rolesInput);
  if (roles.length === 0) throw new TeamError("INVALID", "Choisissez au moins un rôle.");

  return db.transaction(async (tx) => {
    await lockCompany(tx, actor.companyId);
    const target = await loadTarget(tx, actor, userId);
    const before =(await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, target.id))).map((r) => r.role);

    const losesAdmin = before.includes("COMPANY_ADMIN") && !roles.includes("COMPANY_ADMIN");
    if (losesAdmin && target.isActive && (await otherActiveAdmins(tx, actor.companyId, target.id)) === 0) {
      throw new TeamError("LAST_ADMIN", "L'entreprise doit garder au moins un admin actif.");
    }

    await tx.delete(userRoles).where(eq(userRoles.userId, target.id));
    await tx.insert(userRoles).values(roles.map((role) => ({ userId: target.id, role })));
    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "USER_ROLES_CHANGED",
      actorType: "USER",
      actorId: actor.id,
      payload: { userId: target.id, before, after: roles },
    });
    return roles;
  });
}

// ─── Activation / désactivation du compte ─────────────────────────────────────

export async function setUserActive(db: Executor, actor: CompanyUserIdentity, userId: string, active: boolean) {
  assertAdmin(actor);
  if (userId === actor.id) throw new TeamError("SELF", "Vous ne pouvez pas modifier votre propre accès.");

  return db.transaction(async (tx) => {
    await lockCompany(tx, actor.companyId);
    const target = await loadTarget(tx, actor, userId);
    if (target.isActive === active) return;

    if (!active) {
      const isAdmin = (await tx.select().from(userRoles).where(and(eq(userRoles.userId, target.id), eq(userRoles.role, "COMPANY_ADMIN")))).length > 0;
      if (isAdmin && (await otherActiveAdmins(tx, actor.companyId, target.id)) === 0) {
        throw new TeamError("LAST_ADMIN", "L'entreprise doit garder au moins un admin actif.");
      }
    }

    await tx.update(users).set({ isActive: active }).where(eq(users.id, target.id));
    if (!active) {
      // Coupe tout de suite ses sessions et ses liens d'activation en cours
      const now = new Date();
      await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, target.id), isNull(sessions.revokedAt)));
      await tx
        .update(userAccessTokens)
        .set({ revokedAt: now })
        .where(and(eq(userAccessTokens.userId, target.id), isNull(userAccessTokens.usedAt), isNull(userAccessTokens.revokedAt)));
    }
    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      actorType: "USER",
      actorId: actor.id,
      payload: { userId: target.id },
    });
  });
}

// ─── Nouveau lien d'activation ────────────────────────────────────────────────

export async function regenerateTeamLink(db: Executor, actor: CompanyUserIdentity, userId: string) {
  assertAdmin(actor);
  return db.transaction(async (tx) => {
    const target = await loadTarget(tx, actor, userId);
    if (target.activatedAt) throw new TeamError("ALREADY_ACTIVE", "Ce compte est déjà activé.");
    if (!target.isActive) throw new TeamError("INVALID", "Réactivez d'abord ce compte.");

    const issued = await issueActivationToken(tx, target.id, { userId: actor.id });
    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "ACTIVATION_LINK_REGENERATED",
      actorType: "USER",
      actorId: actor.id,
      payload: { userId: target.id },
    });
    return { ...issued, name: target.name };
  });
}
