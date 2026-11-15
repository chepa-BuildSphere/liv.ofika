"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  clearAdminCookie,
  getRequestMeta,
  readAdminToken,
  setAdminCookie,
} from "@/lib/auth/admin-session";
import { loginPlatformAdmin, logoutPlatformAdmin } from "@/lib/auth/platform-admin";

export type LoginState = { error?: string; email?: string };

const MESSAGES = {
  INVALID: "E-mail ou mot de passe incorrect.",
  LOCKED: "Trop d'essais. Réessayez dans 15 minutes.",
} as const;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Renseignez l'e-mail et le mot de passe.", email };

  const result = await loginPlatformAdmin(db, email, password, await getRequestMeta());
  if (!result.ok) return { error: MESSAGES[result.error], email };

  await setAdminCookie(result.token, result.expiresAt);
  redirect("/admin");
}

export async function logoutAction() {
  await logoutPlatformAdmin(db, await readAdminToken(), await getRequestMeta());
  await clearAdminCookie();
  redirect("/admin/login");
}
