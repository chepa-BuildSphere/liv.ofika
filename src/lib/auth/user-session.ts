import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/db";
import { getCompanyUserBySession, type CompanyUserIdentity } from "./company-user";

// Couche Next.js de l'auth des utilisateurs d'entreprise. Cookie distinct de
// celui du back-office : les deux espaces ne se mélangent jamais.

export const USER_COOKIE = "ofika_session";

export async function readUserToken() {
  return (await cookies()).get(USER_COOKIE)?.value;
}

export async function setUserCookie(token: string, expiresAt: Date) {
  (await cookies()).set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearUserCookie() {
  (await cookies()).delete(USER_COOKIE);
}

export async function getCurrentUser(): Promise<CompanyUserIdentity | null> {
  await connection(); // validité de session = heure + base : toujours à la requête
  return getCompanyUserBySession(db, await readUserToken());
}

/** Utilisateur connecté, sinon redirection vers /connexion. */
export async function requireUser(): Promise<CompanyUserIdentity> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}
