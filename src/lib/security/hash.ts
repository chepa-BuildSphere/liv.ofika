import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

// Trois façons de hacher, selon ce qu'on protège (base-de-donnees.md : jamais en clair).
//
// 1. hashSecret / verifySecret  → mots de passe et PIN livreur.
//    Peu d'entropie et longue durée de vie : scrypt, lent et salé.
// 2. hashToken                  → jetons QR, sessions, clés API.
//    128 bits aléatoires : impossibles à deviner, un SHA-256 suffit
//    et permet de retrouver la ligne par une recherche exacte en base.
// 3. hashCode / verifyCode       → code de remise (4 chiffres) et OTP (6 chiffres).
//    Très peu d'entropie et courte durée : HMAC avec une clé serveur. Sans
//    la clé, une fuite de la base ne permet pas de retrouver les codes.

// ─── 1. scrypt ────────────────────────────────────────────────────────────────

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLen: 32, saltLen: 16 } as const;

function scryptAsync(secret: string, salt: Buffer, N: number, r: number, p: number, keyLen: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(secret, salt, keyLen, { N, r, p, maxmem: 256 * N * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Format stocké : scrypt$N$r$p$<sel base64url>$<hash base64url> */
export async function hashSecret(secret: string): Promise<string> {
  if (!secret) throw new Error("Secret vide");
  const salt = randomBytes(SCRYPT.saltLen);
  const key = await scryptAsync(secret, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keyLen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64url");
  const key = await scryptAsync(
    secret,
    Buffer.from(saltB64, "base64url"),
    Number(n),
    Number(r),
    Number(p),
    expected.length,
  );
  return timingSafeEqual(key, expected);
}

/** Vrai si le hash a été fait avec des paramètres plus faibles que les actuels. */
export function secretNeedsRehash(stored: string): boolean {
  const [algo, n, r, p] = stored.split("$");
  return algo !== "scrypt" || Number(n) < SCRYPT.N || Number(r) < SCRYPT.r || Number(p) < SCRYPT.p;
}

// ─── 2. SHA-256 ───────────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// ─── 3. HMAC ──────────────────────────────────────────────────────────────────

/** Sous-clé dédiée, dérivée de ENCRYPTION_KEY : chaque usage a sa propre clé. */
export function deriveKey(masterKey: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey, Buffer.alloc(0), `ofika:${purpose}`, 32));
}

/**
 * `context` lie le code à son objet (ex. id du QR) : le même code "1234" donne
 * un hash différent sur deux QR, et un hash ne peut pas être recopié ailleurs.
 */
export function hashCode(code: string, context: string, masterKey: Buffer): string {
  const key = deriveKey(masterKey, "code-hash");
  return createHmac("sha256", key).update(`${context}\u0000${code}`, "utf8").digest("hex");
}

export function verifyCode(code: string, context: string, stored: string, masterKey: Buffer): boolean {
  return safeEqualHex(hashCode(code, context, masterKey), stored);
}

// ─── Comparaison à temps constant ─────────────────────────────────────────────

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}
