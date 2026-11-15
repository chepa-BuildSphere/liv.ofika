import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  apiKeyEnvironment,
  decryptSecret,
  encryptSecret,
  generateApiKey,
  hashCode,
  hashSecret,
  hashToken,
  randomDigits,
  randomToken,
  safeEqualHex,
  secretNeedsRehash,
  verifyCode,
  verifySecret,
} from ".";

const KEY = randomBytes(32);

describe("randomToken", () => {
  it("fait 128 bits par défaut, en base64url", () => {
    const t = randomToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(16);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("ne se répète pas", () => {
    const set = new Set(Array.from({ length: 1000 }, () => randomToken()));
    expect(set.size).toBe(1000);
  });

  it("refuse moins de 128 bits", () => {
    expect(() => randomToken(8)).toThrow();
  });
});

describe("randomDigits", () => {
  it("donne exactement N chiffres, zéros initiaux compris", () => {
    for (let i = 0; i < 500; i++) expect(randomDigits(4)).toMatch(/^\d{4}$/);
    expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });

  it("couvre tous les chiffres de façon à peu près uniforme", () => {
    const many = Array.from({ length: 5000 }, () => randomDigits(1));
    const freq = new Array(10).fill(0);
    for (const d of many) freq[+d]++;
    for (const f of freq) expect(f).toBeGreaterThan(350); // ~500 attendus
  });

  it("refuse une longueur invalide", () => {
    expect(() => randomDigits(0)).toThrow();
    expect(() => randomDigits(1.5)).toThrow();
  });
});

describe("hashSecret / verifySecret (PIN, mots de passe)", () => {
  it("vérifie le bon PIN et refuse un faux", async () => {
    const stored = await hashSecret("482913");
    expect(stored).not.toContain("482913");
    expect(await verifySecret("482913", stored)).toBe(true);
    expect(await verifySecret("482914", stored)).toBe(false);
  });

  it("est salé : deux hash du même PIN diffèrent", async () => {
    const [a, b] = await Promise.all([hashSecret("123456"), hashSecret("123456")]);
    expect(a).not.toBe(b);
  });

  it("refuse un hash mal formé sans planter", async () => {
    expect(await verifySecret("123456", "n'importe quoi")).toBe(false);
  });

  it("refuse un secret vide", async () => {
    await expect(hashSecret("")).rejects.toThrow();
  });

  it("signale les hash à refaire", async () => {
    expect(secretNeedsRehash(await hashSecret("x"))).toBe(false);
    expect(secretNeedsRehash("scrypt$1024$8$1$aa$bb")).toBe(true);
  });
});

describe("hashToken (QR, sessions, clés API)", () => {
  it("est déterministe, en hex SHA-256, sans le jeton en clair", () => {
    const t = randomToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
});

describe("hashCode / verifyCode (code de remise, OTP)", () => {
  it("vérifie le bon code et refuse un faux", () => {
    const stored = hashCode("0427", "qr-1", KEY);
    expect(verifyCode("0427", "qr-1", stored, KEY)).toBe(true);
    expect(verifyCode("0428", "qr-1", stored, KEY)).toBe(false);
  });

  it("lie le code à son contexte", () => {
    expect(hashCode("0427", "qr-1", KEY)).not.toBe(hashCode("0427", "qr-2", KEY));
    expect(verifyCode("0427", "qr-2", hashCode("0427", "qr-1", KEY), KEY)).toBe(false);
  });

  it("ne peut pas être retrouvé sans la clé serveur", () => {
    const stored = hashCode("0427", "qr-1", KEY);
    expect(verifyCode("0427", "qr-1", stored, randomBytes(32))).toBe(false);
  });

  it("safeEqualHex refuse des longueurs différentes ou vides", () => {
    expect(safeEqualHex("ab", "abcd")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("encryptSecret / decryptSecret (secret webhook)", () => {
  it("rend le texte d'origine", () => {
    const secret = "whsec_" + randomToken(32);
    const stored = encryptSecret(secret, KEY, "endpoint-1");
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored, KEY, "endpoint-1")).toBe(secret);
  });

  it("donne un résultat différent à chaque chiffrement", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });

  it("échoue avec une autre clé", () => {
    const stored = encryptSecret("secret", KEY);
    expect(() => decryptSecret(stored, randomBytes(32))).toThrow();
  });

  it("échoue si recopié sur une autre ligne (aad)", () => {
    const stored = encryptSecret("secret", KEY, "endpoint-1");
    expect(() => decryptSecret(stored, KEY, "endpoint-2")).toThrow();
  });

  it("échoue si le contenu est modifié", () => {
    const [v, iv, tag, data] = encryptSecret("secret", KEY).split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."), KEY)).toThrow();
  });

  it("refuse un format inconnu", () => {
    expect(() => decryptSecret("pas-un-secret", KEY)).toThrow(/format/);
  });
});

describe("generateApiKey", () => {
  it("produit une clé live, son préfixe visible et son hash", () => {
    const { key, prefix, hash } = generateApiKey("LIVE");
    expect(key.startsWith("ofk_live_")).toBe(true);
    expect(key.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength("ofk_live_".length + 4);
    expect(hash).toBe(hashToken(key));
    expect(apiKeyEnvironment(key)).toBe("LIVE");
  });

  it("reconnaît une clé test et refuse un autre format", () => {
    expect(apiKeyEnvironment(generateApiKey("TEST").key)).toBe("TEST");
    expect(apiKeyEnvironment("sk_live_xxx")).toBeNull();
  });
});
