import { and, asc, eq } from "drizzle-orm";
import { companyCouriers, couriers } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
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

export type CourierErrorCode = "FORBIDDEN" | "INVALID" | "ALREADY_ATTACHED";

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

    return { courierId, created, reattached, name: courierName, phone };
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
export async function listCouriers(db: Executor, actor: CompanyUserIdentity): Promise<CompanyCourier[]> {
  assertCanManage(actor);
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
