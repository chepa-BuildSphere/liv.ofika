import { pgEnum } from "drizzle-orm/pg-core";

// Rôles des utilisateurs d'une entreprise (un utilisateur peut en cumuler plusieurs)
export const userRoleEnum = pgEnum("user_role", [
  "COMPANY_ADMIN", // Admin entreprise
  "MANAGER", // Gestionnaire
  "RETURNS_OFFICER", // Responsable retours
]);

// Statut d'une entreprise sur la plateforme
export const companyStatusEnum = pgEnum("company_status", ["ACTIVE", "SUSPENDED"]);

// Type de relation entre un livreur et une entreprise
export const employmentTypeEnum = pgEnum("employment_type", ["EMPLOYEE", "INDEPENDENT"]);

// Cycle de vie d'un colis (mvp.md §5)
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "ARRIVED",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNING",
  "RETURN_RECEIVED",
  "CANCELLED",
]);

// Mode de preuve demandé à la création de la livraison
export const proofModeEnum = pgEnum("proof_mode", ["QR", "QR_OTP"]);

// Méthode de preuve réellement utilisée pour valider la livraison
export const proofMethodEnum = pgEnum("proof_method", ["QR", "QR_OTP", "OTP", "MANUAL"]);

// Motifs d'échec (mvp.md §6.5)
export const failureReasonEnum = pgEnum("failure_reason", [
  "RECIPIENT_ABSENT", // Destinataire absent
  "RECIPIENT_UNREACHABLE", // Destinataire injoignable
  "RECIPIENT_REFUSED", // Destinataire ayant refusé le colis
  "WRONG_ADDRESS", // Adresse incorrecte
  "PAYMENT_UNAVAILABLE", // Paiement indisponible
  "PACKAGE_DAMAGED", // Colis endommagé
  "OTHER", // Autre motif (commentaire obligatoire)
]);

// Issue d'une tentative de livraison
export const attemptOutcomeEnum = pgEnum("attempt_outcome", ["IN_PROGRESS", "DELIVERED", "FAILED"]);

// Suite choisie par le livreur après un échec
export const afterFailureEnum = pgEnum("after_failure", ["RETRY", "RETURN_TO_DEPOT"]);

// État du colis à la réception d'un retour
export const returnConditionEnum = pgEnum("return_condition", ["GOOD", "DAMAGED"]);

// État d'un QR de validation (et de son code de remise)
export const qrTokenStatusEnum = pgEnum("qr_token_status", [
  "ACTIVE", // Généré, valable 3 minutes
  "USED", // Livraison validée
  "EXPIRED", // Plus de 3 minutes
  "LOCKED", // 3 codes faux saisis
  "REVOKED", // Remplacé par un nouveau QR
]);

// État d'un code OTP (option en maintenance dans le MVP)
export const otpStatusEnum = pgEnum("otp_status", ["ACTIVE", "USED", "EXPIRED", "LOCKED", "REVOKED"]);

// Qui a déclenché un événement du journal d'audit
export const actorTypeEnum = pgEnum("actor_type", [
  "PLATFORM_ADMIN",
  "USER",
  "COURIER",
  "API_KEY",
  "RECIPIENT",
  "SYSTEM",
]);

// Environnement d'une clé API
export const apiKeyEnvironmentEnum = pgEnum("api_key_environment", ["TEST", "LIVE"]);

// État d'un envoi de webhook
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
]);

// Alertes de sécurité
export const securityAlertTypeEnum = pgEnum("security_alert_type", [
  "SUSPICIOUS_DEVICE_REUSE", // Un même appareil « client » sur plusieurs livraisons du même livreur
]);

// Réglages de facturation dont on garde l'historique
export const billingSettingEnum = pgEnum("billing_setting", ["BILLING_ENABLED", "PRICE_PER_DELIVERY"]);

// État d'un relevé mensuel
export const statementStatusEnum = pgEnum("statement_status", ["OPEN", "ISSUED", "PAID"]);
