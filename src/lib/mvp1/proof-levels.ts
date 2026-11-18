import type { ProofMethod } from "@/lib/deliveries/transitions";

export type ProofModeType =
  | "QR"
  | "QR_OTP"
  | "QR_PHOTO"
  | "QR_PHOTO_SIGNATURE"
  | "REVERSE_QR";

export type ProofRequirements = {
  mode: ProofModeType;
  label: string;
  description: string;
  requiresPhoto: boolean;
  requiresSignature: boolean;
  requiresOtp: boolean;
  isReverseQr: boolean;
  targetProofMethod: ProofMethod;
};

export const PROOF_LEVELS: Record<ProofModeType, ProofRequirements> = {
  QR: {
    mode: "QR",
    label: "Standard (QR + Code dicté)",
    description: "QR 3 min présenté par le livreur, dictée du code 4 chiffres par le destinataire + GPS + horodatage.",
    requiresPhoto: false,
    requiresSignature: false,
    requiresOtp: false,
    isReverseQr: false,
    targetProofMethod: "QR",
  },
  QR_OTP: {
    mode: "QR_OTP",
    label: "Renforcé (QR + OTP)",
    description: "Validation Standard doublée d'un code OTP à usage unique par SMS/WhatsApp.",
    requiresPhoto: false,
    requiresSignature: false,
    requiresOtp: true,
    isReverseQr: false,
    targetProofMethod: "QR_OTP",
  },
  QR_PHOTO: {
    mode: "QR_PHOTO",
    label: "Renforcé + Photo",
    description: "Validation Standard + prise de photo obligatoire du colis remis entre les mains du destinataire.",
    requiresPhoto: true,
    requiresSignature: false,
    requiresOtp: false,
    isReverseQr: false,
    targetProofMethod: "QR_PHOTO",
  },
  QR_PHOTO_SIGNATURE: {
    mode: "QR_PHOTO_SIGNATURE",
    label: "Maximal (Photo + Signature)",
    description: "Validation Standard + photo du colis remis + signature électronique du destinataire sur l'écran.",
    requiresPhoto: true,
    requiresSignature: true,
    requiresOtp: false,
    isReverseQr: false,
    targetProofMethod: "QR_PHOTO_SIGNATURE",
  },
  REVERSE_QR: {
    mode: "REVERSE_QR",
    label: "QR Inversé (Destinataire présente)",
    description: "Le destinataire présente le QR de sa commande reçu par message/web, le livreur le scanne.",
    requiresPhoto: false,
    requiresSignature: false,
    requiresOtp: false,
    isReverseQr: true,
    targetProofMethod: "REVERSE_QR",
  },
};

export function getProofModeRequirements(mode: string | null | undefined): ProofRequirements {
  const normalized = (mode?.toUpperCase() ?? "QR") as ProofModeType;
  return PROOF_LEVELS[normalized] ?? PROOF_LEVELS.QR;
}

export function validateProofRequirements(
  mode: string | null | undefined,
  input: {
    photoUrl?: string | null;
    signatureUrl?: string | null;
  },
): { valid: boolean; error?: string } {
  const req = getProofModeRequirements(mode);

  if (req.requiresPhoto) {
    if (!input.photoUrl || input.photoUrl.trim().length === 0) {
      return {
        valid: false,
        error: `Une photo du colis remis est obligatoire pour le niveau de preuve « ${req.label} ».`,
      };
    }
  }

  if (req.requiresSignature) {
    if (!input.signatureUrl || input.signatureUrl.trim().length === 0) {
      return {
        valid: false,
        error: `La signature du destinataire sur l'écran est obligatoire pour le niveau de preuve « ${req.label} ».`,
      };
    }
  }

  return { valid: true };
}
