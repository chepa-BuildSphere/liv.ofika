import "server-only";

// Lecture centralisée et vérifiée des variables d'environnement serveur.
// Une variable manquante ou mal formée fait échouer tôt, avec un message clair.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

function encryptionKey(): Buffer {
  const key = Buffer.from(required("ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY doit faire 32 octets encodés en base64 (voir .env.example)");
  }
  return key;
}

function appUrl(): string {
  const url = new URL(required("APP_URL"));
  return url.origin;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get appUrl() {
    return appUrl();
  },
  get encryptionKey() {
    return encryptionKey();
  },
  get realtimeSecret() {
    return required("NEON_REALTIME_SECRET");
  },
};
