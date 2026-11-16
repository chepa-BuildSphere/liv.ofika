// Règles de cycle de vie d'un colis (mvp.md §5). Module pur, sans base de données.
//
// CREATED ──► ASSIGNED ──► PICKED_UP ──► ARRIVED ──► DELIVERED (verrouillé)
//    ▲           │ ↺ réaffectation             │
//    └───────────┘ désaffectation              ▼
//  CANCELLED ◄── avant prise en charge    DELIVERY_FAILED ──► PICKED_UP (nouvelle tentative)
//                                              └──► RETURNING ──► RETURN_RECEIVED (verrouillé)
//  « Forcer Livré » (admin, motif obligatoire) : PICKED_UP, ARRIVED, DELIVERY_FAILED, RETURNING → DELIVERED (MANUAL)

export const DELIVERY_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "ARRIVED",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNING",
  "RETURN_RECEIVED",
  "CANCELLED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type ProofMethod = "QR" | "QR_OTP" | "OTP" | "MANUAL";

/** Transitions normales. DELIVERED ici = validé par preuve (QR, OTP). */
const NORMAL: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  CREATED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ASSIGNED", "CREATED", "PICKED_UP", "CANCELLED"], // ASSIGNED→ASSIGNED = réaffectation
  PICKED_UP: ["ARRIVED"],
  ARRIVED: ["DELIVERED", "DELIVERY_FAILED"],
  DELIVERY_FAILED: ["PICKED_UP", "RETURNING"],
  RETURNING: ["RETURN_RECEIVED"],
  DELIVERED: [],
  RETURN_RECEIVED: [],
  CANCELLED: [],
};

/** Statuts depuis lesquels un admin peut « Forcer Livré ». */
export const FORCE_DELIVERED_FROM: readonly DeliveryStatus[] = [
  "PICKED_UP",
  "ARRIVED",
  "DELIVERY_FAILED",
  "RETURNING",
];

export const LOCKED_STATUSES: readonly DeliveryStatus[] = ["DELIVERED", "RETURN_RECEIVED", "CANCELLED"];

export type TransitionOptions = {
  /** Obligatoire pour DELIVERED. MANUAL = « Forcer Livré ». */
  proofMethod?: ProofMethod;
  /** Motif. Obligatoire pour « Forcer Livré ». */
  reason?: string;
};

export type TransitionCheck = { ok: true; forced: boolean } | { ok: false; code: TransitionError; message: string };

export type TransitionError =
  | "LOCKED"
  | "NOT_ALLOWED"
  | "PROOF_REQUIRED"
  | "PROOF_NOT_ALLOWED"
  | "REASON_REQUIRED";

export function checkTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  opts: TransitionOptions = {},
): TransitionCheck {
  if (LOCKED_STATUSES.includes(from)) {
    return { ok: false, code: "LOCKED", message: `La livraison est verrouillée (${from})` };
  }

  if (to === "DELIVERED") {
    if (!opts.proofMethod) {
      return { ok: false, code: "PROOF_REQUIRED", message: "Une preuve est obligatoire pour passer à DELIVERED" };
    }
    if (opts.proofMethod === "MANUAL") {
      if (!FORCE_DELIVERED_FROM.includes(from)) {
        return { ok: false, code: "NOT_ALLOWED", message: `« Forcer Livré » impossible depuis ${from}` };
      }
      if (!opts.reason?.trim()) {
        return { ok: false, code: "REASON_REQUIRED", message: "Le motif est obligatoire pour « Forcer Livré »" };
      }
      return { ok: true, forced: true };
    }
    // Preuve QR / OTP : uniquement chez le destinataire
    if (from !== "ARRIVED") {
      return { ok: false, code: "NOT_ALLOWED", message: `Transition ${from} → DELIVERED interdite` };
    }
    return { ok: true, forced: false };
  }

  if (opts.proofMethod) {
    return { ok: false, code: "PROOF_NOT_ALLOWED", message: "Une preuve n'a de sens que pour DELIVERED" };
  }
  if (!NORMAL[from].includes(to)) {
    return { ok: false, code: "NOT_ALLOWED", message: `Transition ${from} → ${to} interdite` };
  }
  return { ok: true, forced: false };
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  CREATED: "Créée",
  ASSIGNED: "Affectée",
  PICKED_UP: "Prise en charge",
  ARRIVED: "Arrivé",
  DELIVERED: "Livré",
  DELIVERY_FAILED: "Échec",
  RETURNING: "Retour en cours",
  RETURN_RECEIVED: "Retour réceptionné",
  CANCELLED: "Annulée",
};

export function deliveryStatusLabel(status: DeliveryStatus, proofMethod?: ProofMethod | null): string {
  if (status === "DELIVERED" && proofMethod === "MANUAL") return "Livré (forcé)";
  return DELIVERY_STATUS_LABEL[status];
}

export const FAILURE_REASONS = [
  "RECIPIENT_ABSENT",
  "RECIPIENT_UNREACHABLE",
  "RECIPIENT_REFUSED",
  "WRONG_ADDRESS",
  "PAYMENT_UNAVAILABLE",
  "PACKAGE_DAMAGED",
  "OTHER",
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export const FAILURE_REASON_LABEL: Record<FailureReason, string> = {
  RECIPIENT_ABSENT: "Destinataire absent",
  RECIPIENT_UNREACHABLE: "Destinataire injoignable",
  RECIPIENT_REFUSED: "Destinataire ayant refusé le colis",
  WRONG_ADDRESS: "Adresse incorrecte",
  PAYMENT_UNAVAILABLE: "Paiement indisponible",
  PACKAGE_DAMAGED: "Colis endommagé",
  OTHER: "Autre motif",
};

export const AFTER_FAILURE_CHOICES = ["RETRY", "RETURN_TO_DEPOT"] as const;

export type AfterFailureChoice = (typeof AFTER_FAILURE_CHOICES)[number];

export const AFTER_FAILURE_LABEL: Record<AfterFailureChoice, string> = {
  RETRY: "Nouvelle tentative",
  RETURN_TO_DEPOT: "Retour au dépôt",
};

export const RETURN_CONDITIONS = ["GOOD", "DAMAGED"] as const;

export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const RETURN_CONDITION_LABEL: Record<ReturnCondition, string> = {
  GOOD: "Bon état",
  DAMAGED: "Endommagé",
};
