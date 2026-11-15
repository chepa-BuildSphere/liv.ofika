"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginCompanyUser } from "@/lib/auth/company-user";
import { setUserCookie } from "@/lib/auth/user-session";
import { getRequestMeta } from "@/lib/request-meta";

export type UserLoginState = { error?: string; email?: string };

const MESSAGES = {
  INVALID: "E-mail ou mot de passe incorrect.",
  LOCKED: "Trop d'essais. Réessayez dans 15 minutes.",
  COMPANY_SUSPENDED: "L'accès de votre entreprise est suspendu. Contactez Ofika Delivery.",
} as const;

export async function userLoginAction(_prev: UserLoginState, formData: FormData): Promise<UserLoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Renseignez l'e-mail et le mot de passe.", email };

  const result = await loginCompanyUser(db, email, password, await getRequestMeta());
  if (!result.ok) return { error: MESSAGES[result.error], email };

  await setUserCookie(result.token, result.expiresAt);
  redirect("/espace");
}
