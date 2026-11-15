// Route de test Realtime, désactivée en production.
// Scelle une requête live sur la table jetable `realtime_smoke`
// (créée puis supprimée par scripts/smoke-neon.ts).
import { rawSql } from "@neon/realtime/server";
import { connection } from "next/server";
import { realtime } from "@/lib/realtime/server";

export async function POST() {
  await connection();
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  const query = rawSql<{ id: number; note: string }>(
    "SELECT id, note FROM realtime_smoke ORDER BY id",
    [],
  );
  return Response.json(await realtime.seal({ query }));
}
