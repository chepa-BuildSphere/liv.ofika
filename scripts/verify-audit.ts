// Vérifie l'intégrité du journal d'audit sur la branche liée.
// Usage : npm run audit:verify   (code de sortie 1 si la chaîne est rompue)
import { existsSync } from "node:fs";

// Avant d'importer la base : DATABASE_URL doit être chargée.
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

async function main() {
  const { db, pool } = await import("../src/db");
  const { verifyAuditChain } = await import("../src/lib/audit");

  const result = await verifyAuditChain(db);
  console.log(`Branche : ${process.env.NEON_BRANCH}`);
  if (result.ok) {
    console.log(`✔ Chaîne intacte : ${result.checked} événement(s) vérifié(s)`);
  } else {
    console.error(`✘ Chaîne ROMPUE à l'événement #${result.brokenAtId} : ${result.reason}`);
    console.error(`  (${result.checked} événement(s) valides avant la rupture)`);
  }
  await pool.end();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("✘ ÉCHEC :", (e as Error).message);
  process.exit(1);
});
