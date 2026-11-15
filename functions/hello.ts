// Fonction Neon "hello" : vérifie qu'elle tourne et qu'elle joint la base de sa branche.
// Ne renvoie aucune donnée métier : seulement l'état de santé.
import { attachDatabasePool } from "@neon/functions";
import { Pool } from "pg";

// Pool créé une seule fois par isolat, petit `max` car chaque isolat a le sien.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

export default {
  async fetch(): Promise<Response> {
    const { rows } = await pool.query<{ now: Date }>("SELECT now() AS now");
    return Response.json({
      ok: true,
      service: "neon-function",
      branch: process.env.NEON_BRANCH ?? null,
      dbTime: rows[0].now,
    });
  },
};
