import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// L'app tourne sur un serveur Node longue durée (VPS) : un pool `pg` partagé
// sur l'URL *poolée* de Neon est le bon choix (pas le driver serverless HTTP).
// En dev, Next recharge les modules : on garde le pool sur globalThis.
const globalForDb = globalThis as unknown as { ofikaPool?: Pool };

export const pool =
  globalForDb.ofikaPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10, keepAlive: true });

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
