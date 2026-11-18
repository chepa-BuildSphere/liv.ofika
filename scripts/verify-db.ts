// Vérifie la base de la branche liée (tâche 0.3) sans y laisser de trace :
// tout le test se fait dans une transaction annulée à la fin.
// Usage : npm run db:verify
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { normalizePgConnectionString } from "../src/db";

loadEnvConfig(process.cwd());

async function expectRefused(pg: Client, label: string, sqlText: string) {
  await pg.query("SAVEPOINT t");
  try {
    const r = await pg.query(sqlText);
    await pg.query("RELEASE SAVEPOINT t");
    throw new Error(`${label} a été ACCEPTÉ (${r.rowCount} ligne) : protection absente`);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("ACCEPTÉ")) throw e;
    await pg.query("ROLLBACK TO SAVEPOINT t");
    console.log(`✔ ${label} refusé : ${msg}`);
  }
}

async function main() {
  const pg = new Client({
    connectionString: normalizePgConnectionString(process.env.DATABASE_URL_UNPOOLED),
  });
  await pg.connect();
  try {
    console.log(`Branche : ${process.env.NEON_BRANCH}`);

    const tables = await pg.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
    );
    console.log(`Tables dans public : ${tables.rows[0].n}`);

    const triggers = await pg.query(
      "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname",
    );
    console.log(`Triggers : ${triggers.rows.map((r) => r.tgname).join(", ")}`);

    const flag = await pg.query("SELECT enabled FROM feature_flags WHERE key = 'otp_enabled'");
    console.log(`feature_flags.otp_enabled = ${flag.rows[0]?.enabled}`);

    const actor = await pg.query(
      "SELECT unnest(enum_range(NULL::actor_type))::text AS v LIMIT 1",
    );

    await pg.query("BEGIN");
    const ins = await pg.query(
      "INSERT INTO audit_events (event_type, actor_type, hash) VALUES ('TEST_VERIFY', $1, 'test') RETURNING id",
      [actor.rows[0].v],
    );
    const id = ins.rows[0].id;
    console.log(`✔ INSERT audit_events accepté (id ${id})`);

    await expectRefused(pg, "UPDATE audit_events", `UPDATE audit_events SET event_type = 'X' WHERE id = ${id}`);
    await expectRefused(pg, "DELETE audit_events", `DELETE FROM audit_events WHERE id = ${id}`);
    await expectRefused(pg, "TRUNCATE audit_events", "TRUNCATE audit_events");

    await pg.query("ROLLBACK");
    console.log("\nTransaction annulée : aucune donnée de test ne reste.");
    console.log("✔ Tâche 0.3 validée");
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error("✘ ÉCHEC :", (e as Error).message);
  process.exit(1);
});
