import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Normalise `sslmode=require|prefer|verify-ca` en `sslmode=verify-full` pour
 * éviter l'avertissement de sécurité `pg-connection-string` (qui déclenche une
 * Console Error dans Next.js 16 Turbopack) tout en conservant la vérification TLS stricte.
 */
export function normalizePgConnectionString(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const sslmode = parsed.searchParams.get("sslmode");
    if (
      (sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") &&
      !parsed.searchParams.has("uselibpqcompat")
    ) {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizePgConnectionString(process.env.DATABASE_URL);
}
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL_UNPOOLED = normalizePgConnectionString(process.env.DATABASE_URL_UNPOOLED);
}

// L'app tourne sur un serveur Node longue durée (VPS) : un pool `pg` partagé
// sur l'URL *poolée* de Neon est le bon choix (pas le driver serverless HTTP).
// En dev, Next recharge les modules : on garde le pool sur globalThis.
const globalForDb = globalThis as unknown as { ofikaPool?: Pool };

export const pool =
  globalForDb.ofikaPool ??
  new Pool({
    connectionString: normalizePgConnectionString(process.env.DATABASE_URL),
    max: 10,
    keepAlive: true,
  });

if (process.env.NODE_ENV !== "production") globalForDb.ofikaPool = pool;

// Une connexion inactive ou coupée en cours de requête ne doit pas faire planter le process.
pool.on("error", (err) => console.error("[db] erreur sur une connexion inactive", err));
pool.on("connect", (client) => {
  client.on("error", (err) => console.error("[db] erreur sur une connexion active", err));
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;

/** Nom de la base, lu dans DATABASE_URL (utile pour Realtime). */
export function databaseName(): string {
  return new URL(process.env.DATABASE_URL!).pathname.slice(1);
}
