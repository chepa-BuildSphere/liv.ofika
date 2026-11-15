import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deriveKey } from "./hash";

// Chiffrement AES-256-GCM des secrets qu'il faut pouvoir relire
// (le secret de signature des webhooks : base-de-donnees.md).
//
// Format stocké : v1.<iv>.<tag>.<texte chiffré>   (base64url)
// `aad` (ex. id du endpoint) lie le texte chiffré à sa ligne : recopié sur une
// autre ligne, il ne se déchiffre plus.

const VERSION = "v1";

export function encryptSecret(plain: string, masterKey: Buffer, aad = ""): string {
  const key = deriveKey(masterKey, "secret-encryption");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, masterKey: Buffer, aad = ""): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Secret chiffré illisible (format inconnu)");
  }
  const key = deriveKey(masterKey, "secret-encryption");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(), // lève une erreur si la clé, l'aad ou le contenu ne correspondent pas
  ]).toString("utf8");
}
