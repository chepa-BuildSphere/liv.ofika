// Garde unique des droits (mvp.md §4). Toute décision « qui peut faire quoi »
// passe par `can()` / `assertCan()`, côté serveur. Module pur : aucune base,
// aucune requête, l'appelant fournit l'acteur et la ressource déjà chargés.
//
// Règles appliquées partout :
//   1. Refus par défaut : une action absente de la table est interdite.
//   2. Cloisonnement : la ressource doit appartenir à l'entreprise de l'acteur.
//   3. Le livreur n'agit que sur SES colis, dans une entreprise où il est rattaché.
//   6. Séparation des rôles : on ne réceptionne pas un retour qu'on a déclaré,
//      on ne force pas « Livré » sur un colis qu'on a livré soi-même.
//   9. L'admin plateforme ne lit les données d'une entreprise que pour le
//      support : la décision le signale (`supportAccess`) pour journalisation.

import type { DeliveryStatus } from "@/lib/deliveries/transitions";

export type UserRole = "COMPANY_ADMIN" | "MANAGER" | "RETURNS_OFFICER";

// ─── Acteurs ──────────────────────────────────────────────────────────────────

export type Actor =
  | { kind: "platformAdmin"; id: string }
  | {
      kind: "user";
      id: string;
      companyId: string;
      roles: readonly UserRole[];
      /** Compte livreur de la même personne, s'il existe (règle 6). */
      courierId?: string | null;
    }
  | { kind: "courier"; id: string; /** Entreprises où il est rattaché et actif. */ companyIds: readonly string[] }
  | { kind: "apiKey"; id: string; companyId: string };

// ─── Ressources ───────────────────────────────────────────────────────────────

export type CompanyRef = { companyId: string };

export type DeliveryRef = {
  companyId: string;
  status: DeliveryStatus;
  courierId: string | null;
  /** Livreur qui a déclaré le retour (statut RETURNING / RETURN_RECEIVED). */
  returnDeclaredByCourierId?: string | null;
};

export type AuditRef = {
  companyId: string | null;
  actorType: string;
  actorId: string | null;
  /** L'événement concerne un retour (pour le responsable retours). */
  concernsReturn: boolean;
};

// ─── Actions : une par ligne de la matrice §4.2 ───────────────────────────────

type ActionResources = {
  "company.createOrSuspend": undefined;
  "company.manageUsers": CompanyRef;
  "couriers.manage": CompanyRef;
  "apiKeys.manage": CompanyRef;
  "webhooks.configure": CompanyRef;
  "otp.enable": CompanyRef;
  "billing.viewStatements": CompanyRef;
  "billing.toggle": CompanyRef;
  "billing.setPrice": CompanyRef;
  "billing.markPaid": CompanyRef;
  "delivery.create": CompanyRef;
  "delivery.editBeforePickup": DeliveryRef;
  "delivery.editAfterPickup": DeliveryRef;
  "delivery.cancelBeforePickup": DeliveryRef;
  "delivery.assignCourier": DeliveryRef;
  "delivery.view": DeliveryRef;
  "delivery.viewRecipientContact": DeliveryRef;
  "delivery.confirmPickup": DeliveryRef;
  "delivery.declareArrived": DeliveryRef;
  "delivery.showQr": DeliveryRef;
  "delivery.enterHandoverCode": DeliveryRef;
  "delivery.enterOtp": DeliveryRef;
  "proof.viewSecrets": DeliveryRef;
  "delivery.declareFailureOrRetry": DeliveryRef;
  "delivery.forceDelivered": DeliveryRef;
  "return.receive": DeliveryRef;
  "audit.view": AuditRef;
  "audit.modify": AuditRef;
  "delivery.generatePdf": DeliveryRef;
  // Actions MVP 1
  "cash.reconcile": CompanyRef;
  "cash.viewHandovers": CompanyRef;
  "dispute.manage": DeliveryRef;
  "delivery.comment": DeliveryRef;
};

export type Action = keyof ActionResources;

export type Decision =
  | { allowed: true; /** Accès support de l'admin plateforme : à journaliser. */ supportAccess?: true; readOnly?: true }
  | { allowed: false; reason: string };

const ALLOW: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });
const SUPPORT: Decision = { allowed: true, supportAccess: true, readOnly: true };

// ─── Briques de règles ────────────────────────────────────────────────────────

const BEFORE_PICKUP: readonly DeliveryStatus[] = ["CREATED", "ASSIGNED"];
const RETURN_STATUSES: readonly DeliveryStatus[] = ["RETURNING", "RETURN_RECEIVED"];
/** Colis « actifs » pour le livreur : il en a besoin pour livrer. */
const COURIER_ACTIVE: readonly DeliveryStatus[] = ["ASSIGNED", "PICKED_UP", "ARRIVED", "DELIVERY_FAILED"];

type Rule<R> = (actor: Actor, resource: R) => Decision;

function sameCompany(actor: Actor, companyId: string | null): boolean {
  return (actor.kind === "user" || actor.kind === "apiKey") && companyId !== null && actor.companyId === companyId;
}

/** Utilisateur de l'entreprise de la ressource, ayant l'un des rôles. */
function userWith<R extends { companyId: string | null }>(roles: readonly UserRole[]): Rule<R> {
  return (actor, r) => {
    if (actor.kind !== "user") return deny("Réservé aux utilisateurs de l'entreprise");
    if (!sameCompany(actor, r.companyId)) return deny("Autre entreprise");
    if (!actor.roles.some((role) => roles.includes(role))) return deny(`Rôle requis : ${roles.join(" ou ")}`);
    return ALLOW;
  };
}

function apiKeyOfCompany<R extends { companyId: string | null }>(actor: Actor, r: R): Decision {
  return actor.kind === "apiKey" && sameCompany(actor, r.companyId) ? ALLOW : deny("Autre entreprise");
}

/** Livreur affecté à ce colis, rattaché à son entreprise. */
const ownCourier: Rule<DeliveryRef> = (actor, d) => {
  if (actor.kind !== "courier") return deny("Réservé au livreur");
  if (d.courierId !== actor.id) return deny("Colis affecté à un autre livreur");
  if (!actor.companyIds.includes(d.companyId)) return deny("Livreur non rattaché à cette entreprise");
  return ALLOW;
};

const platformOnly: Rule<unknown> = (actor) => (actor.kind === "platformAdmin" ? ALLOW : deny("Réservé à l'admin plateforme"));
const platformSupport: Rule<unknown> = (actor) => (actor.kind === "platformAdmin" ? SUPPORT : deny("Réservé à l'admin plateforme"));
const nobody: Rule<unknown> = () => deny("Interdit à tous");

/** Premier « oui » l'emporte ; sinon le dernier refus est renvoyé. */
function anyOf<R>(...rules: Rule<R>[]): Rule<R> {
  return (actor, r) => {
    let last: Decision = deny("Non autorisé");
    for (const rule of rules) {
      const d = rule(actor, r);
      if (d.allowed) return d;
      last = d;
    }
    return last;
  };
}

/** Ajoute une condition sur la ressource à une règle. */
function when<R>(rule: Rule<R>, ok: (r: R, actor: Actor) => boolean, reason: string): Rule<R> {
  return (actor, r) => {
    const d = rule(actor, r);
    if (!d.allowed) return d;
    return ok(r, actor) ? d : deny(reason);
  };
}

const beforePickup = <R extends DeliveryRef>(rule: Rule<R>) =>
  when(rule, (d) => BEFORE_PICKUP.includes(d.status), "Possible seulement avant la prise en charge");

const readOnly = <R>(rule: Rule<R>): Rule<R> => (actor, r) => {
  const d = rule(actor, r);
  return d.allowed ? { ...d, readOnly: true } : d;
};

// ─── La matrice ───────────────────────────────────────────────────────────────

const ADMIN: readonly UserRole[] = ["COMPANY_ADMIN"];
const ADMIN_MANAGER: readonly UserRole[] = ["COMPANY_ADMIN", "MANAGER"];
const ADMIN_MANAGER_RETURNS: readonly UserRole[] = ["COMPANY_ADMIN", "MANAGER", "RETURNS_OFFICER"];

const MATRIX: { [A in Action]: Rule<ActionResources[A]> } = {
  "company.createOrSuspend": platformOnly,
  // ¹ L'admin plateforme crée seulement le premier admin (createCompanyWithAdmin), il ne gère pas l'équipe.
  "company.manageUsers": userWith(ADMIN),
  "couriers.manage": userWith(ADMIN_MANAGER),
  "apiKeys.manage": userWith(ADMIN),
  "webhooks.configure": userWith(ADMIN),
  "otp.enable": userWith(ADMIN),
  "billing.viewStatements": anyOf(platformOnly, readOnly(userWith(ADMIN))),
  "billing.toggle": platformOnly,
  "billing.setPrice": platformOnly,
  "billing.markPaid": platformOnly,

  "delivery.create": anyOf(userWith(ADMIN_MANAGER), apiKeyOfCompany),
  "delivery.editBeforePickup": beforePickup(anyOf(userWith(ADMIN_MANAGER), apiKeyOfCompany)),
  "delivery.editAfterPickup": nobody,
  "delivery.cancelBeforePickup": beforePickup(anyOf(userWith(ADMIN_MANAGER), apiKeyOfCompany)),
  "delivery.assignCourier": beforePickup(anyOf(userWith(ADMIN_MANAGER), apiKeyOfCompany)),

  "delivery.view": anyOf(
    platformSupport,
    userWith(ADMIN_MANAGER),
    when(userWith(["RETURNS_OFFICER"]), (d: DeliveryRef) => RETURN_STATUSES.includes(d.status), "Seulement les colis en retour"),
    ownCourier,
    apiKeyOfCompany,
  ),
  "delivery.viewRecipientContact": anyOf(
    userWith(ADMIN_MANAGER),
    when(ownCourier, (d) => COURIER_ACTIVE.includes(d.status), "Seulement pendant la livraison"),
    apiKeyOfCompany,
  ),

  "delivery.confirmPickup": ownCourier,
  "delivery.declareArrived": ownCourier,
  "delivery.showQr": when(ownCourier, (d) => d.status === "ARRIVED", "Le QR s'affiche seulement au statut Arrivé"),
  "delivery.enterHandoverCode": ownCourier,
  "delivery.enterOtp": ownCourier,
  "proof.viewSecrets": nobody, // ³ jeton QR, code de remise, OTP : jamais en clair
  "delivery.declareFailureOrRetry": ownCourier,

  // ⁴ Motif obligatoire (vérifié par le service de statut) ; règle 6 ; pas via l'API.
  "delivery.forceDelivered": when(
    userWith(ADMIN),
    (d: DeliveryRef, actor) => !(actor.kind === "user" && actor.courierId && actor.courierId === d.courierId),
    "Interdit sur un colis que vous avez livré vous-même",
  ),
  // Règle 6 : celui qui a déclaré le retour comme livreur ne le réceptionne pas.
  "return.receive": when(
    userWith(ADMIN_MANAGER_RETURNS),
    (d: DeliveryRef, actor) => !(actor.kind === "user" && actor.courierId && actor.courierId === d.returnDeclaredByCourierId),
    "Vous avez déclaré ce retour : un collègue doit le réceptionner",
  ),

  "audit.view": anyOf(
    platformSupport,
    readOnly(userWith(ADMIN_MANAGER)),
    readOnly(when(userWith(["RETURNS_OFFICER"]), (e: AuditRef) => e.concernsReturn, "Seulement les événements de retour")),
    (actor, e: AuditRef) =>
      actor.kind === "courier" && e.actorType === "COURIER" && e.actorId === actor.id
        ? { allowed: true, readOnly: true }
        : deny("Seulement vos propres actions"),
    readOnly(apiKeyOfCompany),
  ),
  "audit.modify": nobody, // règle 4

  "delivery.generatePdf": anyOf(userWith(ADMIN_MANAGER), ownCourier, apiKeyOfCompany),

  // MVP 1 : Rapprochement de caisse réservé Admin et Gestionnaire
  "cash.reconcile": userWith(ADMIN_MANAGER),
  "cash.viewHandovers": anyOf(platformSupport, userWith(ADMIN_MANAGER)),
  // MVP 1 : Gestion des litiges (Admin & Gestionnaire)
  "dispute.manage": userWith(ADMIN_MANAGER),
  // MVP 1 : Commentaires sur livraison (Admin, Gestionnaire et livreur affecté)
  "delivery.comment": anyOf(userWith(ADMIN_MANAGER), ownCourier),
};

export const ACTIONS = Object.keys(MATRIX) as Action[];

// ─── Construction des acteurs ─────────────────────────────────────────────────

export function userActor(u: { id: string; companyId: string; roles: readonly UserRole[]; courierId?: string | null }): Actor {
  return { kind: "user", id: u.id, companyId: u.companyId, roles: u.roles, courierId: u.courierId ?? null };
}

export function platformAdminActor(a: { id: string }): Actor {
  return { kind: "platformAdmin", id: a.id };
}

export function courierActor(c: { id: string; companies: readonly { id: string }[] }): Actor {
  return { kind: "courier", id: c.id, companyIds: c.companies.map((co) => co.id) };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export function can<A extends Action>(actor: Actor | null, action: A, resource: ActionResources[A]): Decision {
  if (!actor) return deny("Non connecté");
  const rule = MATRIX[action] as Rule<ActionResources[A]> | undefined;
  if (!rule) return deny("Action inconnue"); // règle 1 : refus par défaut
  return rule(actor, resource);
}

export class Forbidden extends Error {
  constructor(readonly action: Action, readonly reason: string) {
    super(`Action refusée (${action}) : ${reason}`);
    this.name = "Forbidden";
  }
}

/** Comme `can`, mais lève `Forbidden` si refusé. Renvoie la décision (supportAccess…). */
export function assertCan<A extends Action>(actor: Actor | null, action: A, resource: ActionResources[A]) {
  const d = can(actor, action, resource);
  if (!d.allowed) throw new Forbidden(action, d.reason);
  return d;
}
