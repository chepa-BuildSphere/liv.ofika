import { randomBytes, randomInt } from "node:crypto";

/**
 * Jeton aléatoire sûr, encodé en base64url (sans + / =, utilisable dans une URL).
 * 16 octets = 128 bits : le minimum exigé pour les jetons QR (mvp.md §7).
 */
export function randomToken(bytes = 16): string {
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new Error("Un jeton doit faire au moins 16 octets (128 bits)");
  }
  return randomBytes(bytes).toString("base64url");
}

/**
 * Code numérique de `length` chiffres, zéros initiaux compris ("0042").
 * Tirage uniforme via randomInt (pas de biais de modulo).
 */
export function randomDigits(length: number): string {
  if (!Number.isInteger(length) || length < 1 || length > 12) {
    throw new Error("Longueur de code invalide");
  }
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}
