"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginCourier, logoutCourier } from "@/lib/auth/courier";
import { clearCourierCookie, readCourierToken, setCourierCookie } from "@/lib/auth/courier-session";
import { getRequestMeta } from "@/lib/request-meta";

export type CourierLoginState = { error?: string; phone?: string };

export async function courierLoginAction(_prev: CourierLoginState, formData: FormData): Promise<CourierLoginState> {
  const phone = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const result = await loginCourier(db, phone, pin, await getRequestMeta());

  if (!result.ok) {
    if (result.error === "LOCKED") {
      const at = result.lockedUntil?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
      return { error: `Trop de codes faux : compte bloqué jusqu'à ${at}. Réessayez ensuite.`, phone };
    }
    return { error: "Numéro ou code PIN incorrect.", phone };
  }

  await setCourierCookie(result.token, result.expiresAt);
  redirect("/livreur");
}

export async function courierLogoutAction() {
  await logoutCourier(db, await readCourierToken(), await getRequestMeta());
  await clearCourierCookie();
  redirect("/livreur/connexion");
}
