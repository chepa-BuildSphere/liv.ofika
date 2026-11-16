import { and, asc, eq, isNull } from "drizzle-orm";
import { companyCouriers, courierAccessCodes, couriers } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import type { AuthenticatedApiKey } from "@/lib/api-keys/api-keys";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, userActor } from "@/lib/auth/permissions";
import { tenantScope } from "@/lib/tenant/scope";
import { normalizePhone, PHONE_HINT } from "@/lib/validation";

// Livreurs d'une entreprise (mvp.md §4.1 règle 3, matrice « Créer un livreur /
// le rattacher / le détacher » : admin entreprise et gestionnaire).
//
// Un téléphone = un seul livreur sur toute la plateforme. S'il travaille déjà
// pour une autre entreprise, on le RATTACHE : pas de second compte, son nom
// n'est pas modifié, et l'entreprise ne voit jamais ses autres rattachements.

export type EmploymentType = "EMPLOYEE" | "INDEPENDENT";

export type CourierErrorCode = "FORBIDDEN" | "INVALID" | "ALREADY_ATTACHED" | "NOT_FOUND";

export class CourierError extends Error {
  constructor(
    readonly code: CourierErrorCode,
    message: string,
    readonly fields?: Partial<Record<"name" | "phone" | "employmentType", string>>,
  ) {
    super(message);
    this.name = "CourierError";
  }
}

function assertCanManage(actor: CompanyUserIdentity) {
  if (!can(userActor(actor), "couriers.manage", { companyId: actor.companyId }).allowed) {
    throw new CourierError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
  }
}

export type AddCourierInput = { name: string; phone: string; employmentType: string };

export type AddCourierResult = {
  courierId: string;
  /** true : nouveau compte livreur ; false : livreur existant rattaché. */
  created: boolean;
  /** true : il avait été détaché de cette entreprise, il est rattaché à nouveau. */
  reattached: boolean;
  /** A déjà choisi son PIN (livreur existant) : pas de code d'accès à générer. */
  hasPin: boolean;
  name: string;
  phone: string;
};

export async function addCourier(db: Executor, actor: CompanyUserIdentity, input: AddCourierInput): Promise<AddCourierResult> {
  assertCanManage(actor);

  const fields: NonNullable<CourierError["fields"]> = {};
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const employmentType = input.employmentType as EmploymentType;
  if (name.length < 2 || name.length > 100) fields.name = "Entre 2 et 100 caractères.";
  if (!phone) fields.phone = PHONE_HINT;
  if (employmentType !== "EMPLOYEE" && employmentType !== "INDEPENDENT") fields.employmentType = "Choisissez Employé ou Indépendant.";
  if (Object.keys(fields).length || !phone) throw new CourierError("INVALID", "Formulaire incomplet.", fields);

  return db.transaction(async (tx) => {
    // Le livreur est global (un seul compte par téléphone) : recherche sur toute la plateforme.
    const [existing] = await tx.select().from(couriers).where(eq(couriers.phone, phone)).limit(1).for("update");

    let courierId: string;
    let courierName: string;
    let created = false;
    if (existing) {
      courierId = existing.id;
      courierName = existing.name;
    } else {
      const [row] = await tx.insert(couriers).values({ name, phone }).returning();
      courierId = row.id;
      courierName = row.name;
      created = true;
    }

    const [link] = await tenantScope(tx, actor.companyId).selectAll(companyCouriers, eq(companyCouriers.courierId, courierId));
    let reattached = false;
    if (link?.isActive) {
      throw new CourierError("ALREADY_ATTACHED", "Ce livreur est déjà dans votre liste.", {
        phone: "Ce numéro est déjà celui d'un de vos livreurs.",
      });
    }
    if (link) {
      await tenantScope(tx, actor.companyId).update(
        companyCouriers,
        { isActive: true, employmentType, attachedAt: new Date(), detachedAt: null },
        eq(companyCouriers.courierId, courierId),
      );
      reattached = true;
    } else {
      await tenantScope(tx, actor.companyId).insert(companyCouriers, { courierId, employmentType });
    }

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: created ? "COURIER_CREATED" : "COURIER_ATTACHED",
      actorType: "USER",
      actorId: actor.id,
      payload: { courierId, employmentType, reattached },
    });

    return { courierId, created, reattached, hasPin: !!existing?.pinHash, name: courierName, phone };
  });
}

export type CompanyCourier = {
  id: string;
  name: string;
  phone: string;
  employmentType: EmploymentType;
  attached: boolean;
  /** A déjà choisi son code PIN (premier accès fait). */
  hasPin: boolean;
  attachedAt: Date;
  detachedAt: Date | null;
};

/** Livreurs de l'entreprise de l'acteur, et seulement ce qu'elle doit savoir d'eux. */
export async function listCouriers(
  db: Executor,
  actor: CompanyUserIdentity | AuthenticatedApiKey,
): Promise<CompanyCourier[]> {
  if ("environment" in actor) {
    if (!can({ kind: "apiKey", id: actor.id, companyId: actor.companyId }, "delivery.create", { companyId: actor.companyId }).allowed) {
      throw new CourierError("FORBIDDEN", "Clé API non autorisée.");
    }
  } else {
    assertCanManage(actor);
  }
  const rows = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      phone: couriers.phone,
      pinHash: couriers.pinHash,
      employmentType: companyCouriers.employmentType,
      attached: companyCouriers.isActive,
      attachedAt: companyCouriers.attachedAt,
      detachedAt: companyCouriers.detachedAt,
    })
    .from(companyCouriers)
    .innerJoin(couriers, eq(couriers.id, companyCouriers.courierId))
    .where(and(tenantScope(db, actor.companyId).filter(companyCouriers)))
    .orderBy(asc(couriers.name));

  return rows.map(({ pinHash, ...r }) => ({ ...r, hasPin: pinHash !== null }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Détache un livreur de l'entreprise : il disparaît de ses accès et ne voit
 * plus ses colis, tout en conservant son compte Ofika et ses autres entreprises.
 */
export async function detachCourier(
  db: Executor,
  actor: CompanyUserIdentity,
  courierId: string,
): Promise<{ courierId: string; name: string }> {
  assertCanManage(actor);
  if (!UUID_RE.test(courierId)) {
    throw new CourierError("NOT_FOUND", "Livreur introuvable.");
  }

  return db.transaction(async (tx) => {
    const [link] = await tenantScope(tx, actor.companyId).selectAll(
      companyCouriers,
      eq(companyCouriers.courierId, courierId),
    );
    if (!link || !link.isActive) {
      throw new CourierError("NOT_FOUND", "Livreur introuvable.");
    }

    const [courier] = await tx.select({ name: couriers.name }).from(couriers).where(eq(couriers.id, courierId)).limit(1);
    const now = new Date();

    await tenantScope(tx, actor.companyId).update(
      companyCouriers,
      { isActive: false, detachedAt: now },
      eq(companyCouriers.courierId, courierId),
    );

    // Révoque les éventuels codes de premier accès émis par cette entreprise
    await tx
      .update(courierAccessCodes)
      .set({ revokedAt: now })
      .where(
        and(
          eq(courierAccessCodes.courierId, courierId),
          eq(courierAccessCodes.issuedByCompanyId, actor.companyId),
          isNull(courierAccessCodes.usedAt),
          isNull(courierAccessCodes.revokedAt),
        ),
      );

    await logEvent(tx, {
      companyId: actor.companyId,
      eventType: "COURIER_DETACHED",
      actorType: "USER",
      actorId: actor.id,
      payload: { courierId },
    });

    return { courierId, name: courier?.name ?? "" };
  });
}
