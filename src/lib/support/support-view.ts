import { and, desc, eq, gt } from "drizzle-orm";
import { auditEvents } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, userActor } from "@/lib/auth/permissions";
import { tenantScope } from "@/lib/tenant/scope";

// Règle 9 (mvp.md §4.1) : « chaque consultation des données d'une entreprise
// par l'admin plateforme crée un événement visible par l'admin entreprise ».

export const SUPPORT_VIEW = "SUPPORT_VIEW";

/** Recharger la même page dans ce délai ne crée pas de nouvel événement. */
export const SUPPORT_VIEW_DEDUP_MS = 5 * 60_000;

/** Libellés lisibles par l'entreprise, par écran consulté. */
export const SUPPORT_VIEW_LABELS = {
  company_detail: "Fiche de l'entreprise et liste des utilisateurs",
} as const;

export type SupportViewKind = keyof typeof SUPPORT_VIEW_LABELS;

export async function logSupportView(
  db: Executor,
  input: {
    platformAdmin: { id: string; name: string };
    companyId: string;
    view: SupportViewKind;
    ip?: string | null;
    userAgent?: string | null;
  },
) {
  const since = new Date(Date.now() - SUPPORT_VIEW_DEDUP_MS);
  const recent = await db
    .select({ id: auditEvents.id, payload: auditEvents.payload })
    .from(auditEvents)
    .where(
      tenantScope(db, input.companyId).filter(
        auditEvents,
        eq(auditEvents.eventType, SUPPORT_VIEW),
        eq(auditEvents.actorId, input.platformAdmin.id),
        gt(auditEvents.serverTime, since),
      ),
    );
  if (recent.some((e) => (e.payload as { view?: string } | null)?.view === input.view)) return { logged: false };

  await logEvent(db, {
    companyId: input.companyId,
    eventType: SUPPORT_VIEW,
    actorType: "PLATFORM_ADMIN",
    actorId: input.platformAdmin.id,
    payload: { view: input.view, adminName: input.platformAdmin.name },
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { logged: true };
}

export type SupportViewEntry = { at: Date; adminName: string; what: string };

/** Consultations du support pour l'entreprise de l'acteur (droit « audit.view »). */
export async function listSupportViews(db: Executor, actor: CompanyUserIdentity, limit = 50): Promise<SupportViewEntry[] | null> {
  const allowed = can(userActor(actor), "audit.view", {
    companyId: actor.companyId,
    actorType: "PLATFORM_ADMIN",
    actorId: null,
    concernsReturn: false,
  }).allowed;
  if (!allowed) return null;

  const rows = await db
    .select({ at: auditEvents.serverTime, payload: auditEvents.payload })
    .from(auditEvents)
    .where(and(tenantScope(db, actor.companyId).filter(auditEvents, eq(auditEvents.eventType, SUPPORT_VIEW))))
    .orderBy(desc(auditEvents.id))
    .limit(limit);

  return rows.map((r) => {
    const p = (r.payload ?? {}) as { view?: SupportViewKind; adminName?: string };
    return {
      at: r.at,
      adminName: p.adminName ?? "Support Ofika",
      what: (p.view && SUPPORT_VIEW_LABELS[p.view]) ?? "Données de l'entreprise",
    };
  });
}
