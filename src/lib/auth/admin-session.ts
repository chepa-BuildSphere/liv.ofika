import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/db";
import { getPlatformAdminBySession, type AdminIdentity } from "./platform-admin";
import type { SessionMeta } from "./sessions";

// Couche Next.js de l'auth admin plateforme : cookie + garde d'accès.
// À appeler dans chaque page, Server Action et Route Handler du back-office :
// ne jamais se fier à l'interface pour protéger les données.

export const ADMIN_COOKIE = "ofika_admin";

export async function readAdminToken() {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}

export async function setAdminCookie(token: string, expiresAt: Date) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true, // invisible au JavaScript de la page
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** Admin connecté, ou null. */
export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  // Toujours à la requête : la validité d'une session dépend de l'heure actuelle
  // et de la base, jamais d'un pré-rendu.
  await connection();
  return getPlatformAdminBySession(db, await readAdminToken());
}

/** Admin connecté, sinon redirection vers la page de connexion. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function getRequestMeta(): Promise<SessionMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}
