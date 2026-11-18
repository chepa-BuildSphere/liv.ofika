import { describe, expect, it } from "vitest";
import type { DeliveryStatus } from "@/lib/deliveries/transitions";
import { ACTIONS, assertCan, can, Forbidden, type Action, type Actor, type AuditRef, type DeliveryRef } from "./permissions";

// ─────────────────────────────────────────────────────────────────────────────
// Matrice recopiée de docs/mvp.md §4.2, mêmes symboles, même ordre de colonnes :
//   Admin plateforme | Admin entreprise | Gestionnaire | Resp. retours | Livreur | Clé API
//   ✅ autorisé · 👁 lecture seule · 🔸 limité à son périmètre · ❌ interdit
// Si la matrice change dans le document, ce tableau doit changer avec elle.
// ─────────────────────────────────────────────────────────────────────────────
type Cell = "✅" | "👁" | "🔸" | "❌";
const MATRIX: [Action, string, [Cell, Cell, Cell, Cell, Cell, Cell]][] = [
  ["company.createOrSuspend", "Créer / suspendre une entreprise", ["✅", "❌", "❌", "❌", "❌", "❌"]],
  ["company.manageUsers", "Gérer les utilisateurs de l'entreprise", ["❌", "✅", "❌", "❌", "❌", "❌"]],
  ["couriers.manage", "Créer / rattacher / détacher un livreur", ["❌", "✅", "✅", "❌", "❌", "❌"]],
  ["apiKeys.manage", "Créer / révoquer des clés API", ["❌", "✅", "❌", "❌", "❌", "❌"]],
  ["webhooks.configure", "Configurer les webhooks", ["❌", "✅", "❌", "❌", "❌", "❌"]],
  ["otp.enable", "Activer l'option OTP", ["❌", "✅", "❌", "❌", "❌", "❌"]],
  ["billing.viewStatements", "Voir le compteur facturable et le relevé", ["✅", "👁", "❌", "❌", "❌", "❌"]],
  ["billing.toggle", "Activer / désactiver la facturation", ["✅", "❌", "❌", "❌", "❌", "❌"]],
  ["billing.setPrice", "Modifier le prix par livraison", ["✅", "❌", "❌", "❌", "❌", "❌"]],
  ["billing.markPaid", "Marquer un relevé comme payé", ["✅", "❌", "❌", "❌", "❌", "❌"]],
  ["delivery.create", "Créer une livraison", ["❌", "✅", "✅", "❌", "❌", "✅"]],
  ["delivery.editBeforePickup", "Modifier avant prise en charge", ["❌", "✅", "✅", "❌", "❌", "✅"]],
  ["delivery.editAfterPickup", "Modifier après prise en charge", ["❌", "❌", "❌", "❌", "❌", "❌"]],
  ["delivery.cancelBeforePickup", "Annuler avant prise en charge", ["❌", "✅", "✅", "❌", "❌", "✅"]],
  ["delivery.assignCourier", "Affecter / réaffecter un livreur", ["❌", "✅", "✅", "❌", "❌", "✅"]],
  ["delivery.view", "Voir les livraisons", ["👁", "✅", "✅", "🔸", "🔸", "🔸"]],
  ["delivery.viewRecipientContact", "Voir téléphone et adresse du destinataire", ["❌", "✅", "✅", "❌", "🔸", "✅"]],
  ["delivery.confirmPickup", "Confirmer la prise en charge", ["❌", "❌", "❌", "❌", "🔸", "❌"]],
  ["delivery.declareArrived", "Déclarer « Arrivé »", ["❌", "❌", "❌", "❌", "🔸", "❌"]],
  ["delivery.showQr", "Afficher le QR de validation", ["❌", "❌", "❌", "❌", "🔸", "❌"]],
  ["delivery.enterHandoverCode", "Saisir le code de remise", ["❌", "❌", "❌", "❌", "🔸", "❌"]],
  ["delivery.enterOtp", "Saisir l'OTP", ["❌", "❌", "❌", "❌", "🔸", "❌"]],
  ["proof.viewSecrets", "Voir OTP / jeton QR / code en clair", ["❌", "❌", "❌", "❌", "❌", "❌"]],
  ["delivery.declareFailureOrRetry", "Déclarer un échec / nouvelle tentative", ["❌", "❌", "❌", "❌", "🔸", "❌"]],
  ["delivery.forceDelivered", "Forcer Livré", ["❌", "✅", "❌", "❌", "❌", "❌"]],
  ["return.receive", "Réceptionner un retour", ["❌", "✅", "✅", "✅", "❌", "❌"]],
  ["audit.view", "Consulter le journal d'audit", ["👁", "👁", "👁", "👁", "🔸", "👁"]],
  ["audit.modify", "Modifier / supprimer le journal", ["❌", "❌", "❌", "❌", "❌", "❌"]],
  ["delivery.generatePdf", "Générer un bordereau PDF", ["❌", "✅", "✅", "❌", "🔸", "✅"]],
  ["cash.reconcile", "Rapprochement et remise de caisse", ["❌", "✅", "✅", "❌", "❌", "❌"]],
  ["cash.viewHandovers", "Consulter les remises d'espèces", ["👁", "✅", "✅", "❌", "❌", "❌"]],
  ["dispute.manage", "Gérer les litiges", ["❌", "✅", "✅", "❌", "❌", "❌"]],
  ["delivery.comment", "Commenter une livraison", ["❌", "✅", "✅", "❌", "🔸", "❌"]],
];

// ─── Acteurs (entreprise C1) ──────────────────────────────────────────────────
const C1 = "company-1";
const C2 = "company-2";
const COURIER = "courier-1";

const pa: Actor = { kind: "platformAdmin", id: "pa-1" };
const admin: Actor = { kind: "user", id: "u-admin", companyId: C1, roles: ["COMPANY_ADMIN"] };
const manager: Actor = { kind: "user", id: "u-manager", companyId: C1, roles: ["MANAGER"] };
const returns: Actor = { kind: "user", id: "u-returns", companyId: C1, roles: ["RETURNS_OFFICER"] };
const courier: Actor = { kind: "courier", id: COURIER, companyIds: [C1] };
const apiKey: Actor = { kind: "apiKey", id: "key-1", companyId: C1 };
const COLUMNS: [string, Actor][] = [
  ["Admin plateforme", pa],
  ["Admin entreprise", admin],
  ["Gestionnaire", manager],
  ["Resp. retours", returns],
  ["Livreur", courier],
  ["Clé API", apiKey],
];

// ─── Ressource « dans le périmètre » pour chaque action ───────────────────────
const delivery = (status: DeliveryStatus, extra: Partial<DeliveryRef> = {}): DeliveryRef => ({
  companyId: C1,
  status,
  courierId: COURIER,
  returnDeclaredByCourierId: null,
  ...extra,
});
const courierAudit: AuditRef = { companyId: C1, actorType: "COURIER", actorId: COURIER, concernsReturn: true };

const STATUS_FOR: Partial<Record<Action, DeliveryStatus>> = {
  "delivery.view": "RETURNING", // dans le périmètre du resp. retours ET du livreur
  "delivery.showQr": "ARRIVED",
  "return.receive": "RETURNING",
  "delivery.editAfterPickup": "PICKED_UP",
};

function inScope(action: Action): unknown {
  if (action === "company.createOrSuspend") return undefined;
  if (action.startsWith("audit.")) return courierAudit;
  if (
    action.startsWith("delivery.") ||
    action.startsWith("proof.") ||
    action.startsWith("return.") ||
    action.startsWith("dispute.")
  ) {
    return delivery(STATUS_FOR[action] ?? "ASSIGNED");
  }
  return { companyId: C1 };
}

const check = (actor: Actor, action: Action, resource: unknown) =>
  can(actor, action, resource as never);

// ─── 1. Chaque ligne de la matrice a son test ─────────────────────────────────
describe("matrice des droits §4.2 — une ligne = un test", () => {
  for (const [action, label, cells] of MATRIX) {
    it(`${label} (${action})`, () => {
      COLUMNS.forEach(([column, actor], i) => {
        const decision = check(actor, action, inScope(action));
        const expected = cells[i] !== "❌";
        expect(decision.allowed, `${column} → attendu ${cells[i]}`).toBe(expected);
        if (cells[i] === "👁" && decision.allowed) {
          expect(decision.readOnly, `${column} → lecture seule attendue`).toBe(true);
        }
      });
    });
  }

  it("la garde et la matrice ont exactement les mêmes actions", () => {
    expect(MATRIX.map(([a]) => a).sort()).toEqual([...ACTIONS].sort());
  });
});

// ─── 2. Les 🔸 sont bien limités à leur périmètre ─────────────────────────────
describe("périmètres (🔸)", () => {
  it("le resp. retours ne voit que les colis en retour", () => {
    expect(check(returns, "delivery.view", delivery("RETURNING")).allowed).toBe(true);
    expect(check(returns, "delivery.view", delivery("RETURN_RECEIVED")).allowed).toBe(true);
    expect(check(returns, "delivery.view", delivery("ASSIGNED")).allowed).toBe(false);
    expect(check(returns, "delivery.view", delivery("DELIVERED")).allowed).toBe(false);
  });

  it("le livreur n'agit que sur SES colis", () => {
    const other = delivery("ARRIVED", { courierId: "courier-2" });
    for (const action of ["delivery.view", "delivery.declareArrived", "delivery.showQr", "delivery.enterHandoverCode", "delivery.confirmPickup", "delivery.declareFailureOrRetry", "delivery.generatePdf"] as Action[]) {
      expect(check(courier, action, other).allowed, action).toBe(false);
    }
  });

  it("le livreur ne voit le contact du destinataire que pendant la livraison", () => {
    for (const s of ["ASSIGNED", "PICKED_UP", "ARRIVED", "DELIVERY_FAILED"] as DeliveryStatus[]) {
      expect(check(courier, "delivery.viewRecipientContact", delivery(s)).allowed, s).toBe(true);
    }
    for (const s of ["DELIVERED", "RETURNING", "RETURN_RECEIVED", "CANCELLED"] as DeliveryStatus[]) {
      expect(check(courier, "delivery.viewRecipientContact", delivery(s)).allowed, s).toBe(false);
    }
  });

  it("le QR ne s'affiche qu'au statut Arrivé", () => {
    expect(check(courier, "delivery.showQr", delivery("ARRIVED")).allowed).toBe(true);
    expect(check(courier, "delivery.showQr", delivery("PICKED_UP")).allowed).toBe(false);
  });

  it("le livreur ne voit dans l'audit que ses propres actions", () => {
    expect(check(courier, "audit.view", { ...courierAudit, actorId: "courier-2" }).allowed).toBe(false);
    expect(check(courier, "audit.view", { ...courierAudit, actorType: "USER", actorId: COURIER }).allowed).toBe(false);
  });

  it("le resp. retours ne voit dans l'audit que les événements de retour", () => {
    expect(check(returns, "audit.view", { ...courierAudit, concernsReturn: false }).allowed).toBe(false);
  });

  it("un livreur détaché de l'entreprise perd l'accès à ses anciens colis", () => {
    const detached: Actor = { kind: "courier", id: COURIER, companyIds: [] };
    expect(check(detached, "delivery.view", delivery("ARRIVED")).allowed).toBe(false);
  });

  it("modifier, annuler et réaffecter : seulement avant la prise en charge", () => {
    for (const action of ["delivery.editBeforePickup", "delivery.cancelBeforePickup", "delivery.assignCourier"] as Action[]) {
      expect(check(manager, action, delivery("CREATED")).allowed, action).toBe(true);
      for (const s of ["PICKED_UP", "ARRIVED", "DELIVERED"] as DeliveryStatus[]) {
        expect(check(manager, action, delivery(s)).allowed, `${action} ${s}`).toBe(false);
      }
    }
  });
});

// ─── 3. Cloisonnement par entreprise (règle 2) ────────────────────────────────
describe("cloisonnement (règle 2)", () => {
  it("aucun acteur d'une entreprise n'agit sur une autre entreprise", () => {
    const foreignDelivery = delivery("RETURNING", { companyId: C2 });
    const foreignAudit: AuditRef = { ...courierAudit, companyId: C2 };
    for (const [action] of MATRIX) {
      const resource = action === "company.createOrSuspend" ? undefined : action.startsWith("audit.") ? foreignAudit : action.startsWith("delivery.") || action.startsWith("proof.") || action.startsWith("return.") ? foreignDelivery : { companyId: C2 };
      for (const actor of [admin, manager, returns, apiKey]) {
        expect(check(actor, action, resource).allowed, `${actor.kind}/${action}`).toBe(false);
      }
    }
  });

  it("un utilisateur cumulant les rôles reste limité à son entreprise", () => {
    const all: Actor = { kind: "user", id: "u-all", companyId: C1, roles: ["COMPANY_ADMIN", "MANAGER", "RETURNS_OFFICER"] };
    expect(check(all, "delivery.view", delivery("ASSIGNED", { companyId: C2 })).allowed).toBe(false);
    expect(check(all, "company.manageUsers", { companyId: C1 }).allowed).toBe(true);
  });
});

// ─── 4. Séparation des rôles (règle 6) ────────────────────────────────────────
describe("séparation des rôles (règle 6)", () => {
  const adminWhoIsCourier: Actor = { kind: "user", id: "u-x", companyId: C1, roles: ["COMPANY_ADMIN", "RETURNS_OFFICER"], courierId: COURIER };

  it("on ne force pas « Livré » sur un colis qu'on a livré soi-même", () => {
    expect(check(adminWhoIsCourier, "delivery.forceDelivered", delivery("ARRIVED")).allowed).toBe(false);
    expect(check(adminWhoIsCourier, "delivery.forceDelivered", delivery("ARRIVED", { courierId: "courier-2" })).allowed).toBe(true);
  });

  it("on ne réceptionne pas un retour qu'on a déclaré comme livreur", () => {
    const declaredBySelf = delivery("RETURNING", { returnDeclaredByCourierId: COURIER });
    expect(check(adminWhoIsCourier, "return.receive", declaredBySelf).allowed).toBe(false);
    expect(check(returns, "return.receive", declaredBySelf).allowed).toBe(true); // un collègue peut
  });
});

// ─── 5. Refus par défaut, support journalisé, assertCan ───────────────────────
describe("comportements généraux", () => {
  it("refuse sans acteur et pour une action inconnue (règle 1)", () => {
    expect(can(null, "delivery.view", delivery("ASSIGNED")).allowed).toBe(false);
    expect(check(admin, "delivery.teleport" as Action, delivery("ASSIGNED")).allowed).toBe(false);
  });

  it("l'admin plateforme lit en mode support : à journaliser (règle 9)", () => {
    const d = check(pa, "delivery.view", delivery("ASSIGNED"));
    expect(d).toEqual({ allowed: true, supportAccess: true, readOnly: true });
    expect(check(pa, "delivery.viewRecipientContact", delivery("ASSIGNED")).allowed).toBe(false);
  });

  it("assertCan lève Forbidden avec la raison", () => {
    expect(() => assertCan(manager, "apiKeys.manage", { companyId: C1 })).toThrow(Forbidden);
    expect(assertCan(admin, "apiKeys.manage", { companyId: C1 }).allowed).toBe(true);
  });
});
