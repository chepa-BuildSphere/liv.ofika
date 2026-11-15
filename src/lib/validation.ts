// Règles de saisie partagées (formulaires du back-office et de l'espace entreprise).

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Numéro avec indicatif facultatif : "+225 07 00 00 00 00", "0700000000". */
export const PHONE_RE = /^\+?[0-9 ]{8,20}$/;

export const PHONE_HINT = "Numéro invalide (ex. +225 07 00 00 00 00).";
