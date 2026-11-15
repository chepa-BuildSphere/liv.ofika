// Règles de saisie partagées (formulaires du back-office et de l'espace entreprise).

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Numéro avec indicatif facultatif : "+225 07 00 00 00 00", "0700000000". */
export const PHONE_RE = /^\+?[0-9 ]{8,20}$/;

export const PHONE_HINT = "Numéro invalide (ex. +225 07 00 00 00 00).";

/**
 * Forme unique d'un numéro (E.164), pour qu'un même téléphone désigne toujours
 * le même livreur, quelle que soit la façon de le saisir.
 *   "07 07 07 07 07"      → "+2250707070707"  (Côte d'Ivoire, 10 chiffres depuis 2021)
 *   "+225 07-07.07 07 07" → "+2250707070707"
 *   "00225 0707070707"    → "+2250707070707"
 *   "+33 6 12 34 56 78"   → "+33612345678"     (numéro étranger avec indicatif)
 * Renvoie null si le numéro n'est pas exploitable.
 */
export function normalizePhone(input: string): string | null {
  let s = input.trim().replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^0\d{9}$/.test(s)) s = `+225${s}`; // numéro ivoirien sans indicatif
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  if (s.startsWith("+225") && s.length !== 14) return null; // +225 + 10 chiffres
  return s;
}

/** "+2250707070707" → "+225 07 07 07 07 07" (affichage). */
export function formatPhone(e164: string): string {
  if (e164.startsWith("+225") && e164.length === 14) {
    return `+225 ${e164.slice(4).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  }
  return e164;
}
