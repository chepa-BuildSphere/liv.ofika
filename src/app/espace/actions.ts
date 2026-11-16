"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { userActor } from "@/lib/auth/permissions";
import { logoutCompanyUser } from "@/lib/auth/company-user";
import { clearUserCookie, readUserToken, requireUser } from "@/lib/auth/user-session";
import { resolveSecurityAlert } from "@/lib/dashboard/dashboard";
import { getRequestMeta } from "@/lib/request-meta";

export async function userLogoutAction() {
  await logoutCompanyUser(db, await readUserToken(), await getRequestMeta());
  await clearUserCookie();
  redirect("/login");
}

export async function resolveSecurityAlertAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  try {
    const user = await requireUser();
    const actor = userActor(user);
    const alertId = String(formData.get("alertId") ?? "");
    const notes = String(formData.get("notes") ?? "");

    if (!alertId) {
      return { error: "Identifiant d'alerte manquant" };
    }

    await resolveSecurityAlert(actor, alertId, notes.trim() || undefined);
    revalidatePath("/espace");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inattendue" };
  }
}

export async function attemptToggleOtpAction(): Promise<{ error: string }> {
  // L'option OTP est protégée côté serveur contre toute activation frauduleuse dans le MVP
  return {
    error: "L'option preuve par SMS / WhatsApp (OTP) est actuellement en maintenance (bientôt disponible).",
  };
}
