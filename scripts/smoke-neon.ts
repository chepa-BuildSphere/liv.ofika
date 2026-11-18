// Test de bout en bout des services Neon, app lancée en local (npm run dev).
// Usage : npx tsx scripts/smoke-neon.ts [http://localhost:5000]
//   1. /api/health          → Postgres + Fonction Neon "hello" (via l'app)
//   2. Realtime             → l'app scelle une requête, on s'abonne comme un
//                             navigateur, on insère une ligne, on attend le changement.
// La table realtime_smoke est créée puis supprimée.
import { loadEnvConfig } from "@next/env";
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";
import { Client } from "pg";
import { normalizePgConnectionString } from "../src/db";

loadEnvConfig(process.cwd());
const APP = process.argv[2] ?? "http://localhost:5000";
const TABLE = "realtime_smoke";

function step(msg: string) {
  console.log(`\n▶ ${msg}`);
}

async function main() {
  step(`GET ${APP}/api/health`);
  const health = await fetch(`${APP}/api/health`);
  const body = await health.json();
  console.log(`HTTP ${health.status}`, JSON.stringify(body, null, 2));
  if (!body.ok) throw new Error("health KO");

  const pg = new Client({
    connectionString: normalizePgConnectionString(process.env.DATABASE_URL_UNPOOLED),
  });
  await pg.connect();
  try {
    step(`CREATE TABLE ${TABLE}`);
    await pg.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await pg.query(`CREATE TABLE ${TABLE} (id serial PRIMARY KEY, note text NOT NULL)`);
    await pg.query(`INSERT INTO ${TABLE} (note) VALUES ('ligne initiale')`);

    step(`POST ${APP}/api/realtime/smoke (scellement côté app)`);
    const sealedRes = await fetch(`${APP}/api/realtime/smoke`, { method: "POST" });
    if (!sealedRes.ok) throw new Error(`scellement HTTP ${sealedRes.status}`);
    const sealed = (await sealedRes.json()) as SealedLiveQuery<{ id: number; note: string }>;
    console.log("requête scellée reçue, expire à", new Date(sealed.expiresAt).toISOString());

    step("Abonnement WebSocket (client navigateur)");
    const client = createRealtimeClient({ url: process.env.NEON_REALTIME_URL! });
    const sub = client.subscribe(sealed);

    const seen = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("pas de changement reçu en 30 s")), 30_000);
      let inserted = false;
      sub.onChange(async (snap) => {
        if (snap.status === "error") {
          clearTimeout(timer);
          reject(snap.error);
          return;
        }
        if (snap.status !== "live" || !snap.data) return;
        console.log(`[${snap.status}] lignes:`, snap.data.map((r) => r.note));
        if (!inserted) {
          inserted = true;
          console.log("→ INSERT 'ajoutee en direct'");
          await pg.query(`INSERT INTO ${TABLE} (note) VALUES ('ajoutee en direct')`);
        } else if (snap.data.some((r) => r.note === "ajoutee en direct")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    await seen;
    console.log("✔ Realtime : le changement est arrivé en direct");
    sub.unsubscribe();
    client.close();
  } finally {
    step(`DROP TABLE ${TABLE}`);
    await pg.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await pg.end();
  }
  console.log("\n✔ Tous les services Neon fonctionnent");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✘ ÉCHEC :", e);
  process.exit(1);
});
