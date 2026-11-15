import { functionBaseUrl } from "@neon/env";
import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

type Check = { ok: boolean; detail?: unknown; error?: string };

async function checkPostgres(): Promise<Check> {
  try {
    const res = await db.execute<{ db: string; version: string }>(
      sql`SELECT current_database() AS db, current_setting('server_version') AS version`,
    );
    return { ok: true, detail: res.rows[0] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function checkFunction(): Promise<Check> {
  try {
    const res = await fetch(functionBaseUrl("hello"), { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, detail: await res.json() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function checkRealtimeConfig(): Check {
  const ok = Boolean(process.env.NEON_REALTIME_URL && process.env.NEON_REALTIME_SECRET);
  return ok ? { ok } : { ok, error: "NEON_REALTIME_URL / NEON_REALTIME_SECRET manquants" };
}

export async function GET() {
  await connection(); // toujours exécuté à la requête, jamais pré-rendu
  const [postgres, fn] = await Promise.all([checkPostgres(), checkFunction()]);
  const realtime = checkRealtimeConfig();
  const ok = postgres.ok && fn.ok && realtime.ok;
  return Response.json({ ok, postgres, function: fn, realtime }, { status: ok ? 200 : 503 });
}
