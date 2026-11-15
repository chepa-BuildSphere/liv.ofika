import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/db";
import { getCourierBySession, type CourierIdentity } from "./courier";

// Couche Next.js de la session livreur. Cookie distinct du back-office
// (ofika_admin) et de l'espace entreprise (ofika_session).

export const COURIER_COOKIE = "ofika_livreur";

export async function readCourierToken() {
  return (await cookies()).get(COURIER_COOKIE)?.value;
}

export async function setCourierCookie(token: string, expiresAt: Date) {
  (await cookies()).set(COURIER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearCourierCookie() {
  (await cookies()).delete(COURIER_COOKIE);
}

export async function getCurrentCourier(): Promise<CourierIdentity | null> {
  await connection();
  return getCourierBySession(db, await readCourierToken());
}

export async function requireCourier(): Promise<CourierIdentity> {
  const courier = await getCurrentCourier();
  if (!courier) redirect("/livreur/connexion");
  return courier;
}
