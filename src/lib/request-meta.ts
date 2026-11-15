import "server-only";
import { headers } from "next/headers";
import type { SessionMeta } from "@/lib/auth/sessions";

/** IP et navigateur de la requête en cours, pour l'audit et les sessions. */
export async function getRequestMeta(): Promise<SessionMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}
