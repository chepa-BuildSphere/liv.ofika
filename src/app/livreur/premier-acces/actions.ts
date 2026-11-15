"use server";

import { db } from "@/db";
import { env } from "@/env";
import { completeFirstAccess, type FirstAccessResult } from "@/lib/couriers/first-access";
import { getRequestMeta } from "@/lib/request-meta";

// Après une erreur, le téléphone et le code d'accès restent remplis (le livreur
// n'a pas à les retaper sur son téléphone) ; les deux PIN sont toujours vidés.
export type FirstAccessState = { status: "idle" } | { status: "error"; message: string; phone: string; code: string } | { status: "done" };

const MESSAGES: Record<Exclude<FirstAccessResult, { ok: true }>["problem"], string> = {
  INVALID: "Téléphone ou code d'accès incorrect, ou code expiré. Demandez un nouveau code à votre entreprise.",
  LOCKED: "Trop d'essais. Réessayez dans 15 minutes.",
  FORMAT: "Le code PIN doit faire exactement 6 chiffres.",
  WEAK: "Ce code PIN est trop facile à deviner (ex. 123456, 000000). Choisissez-en un autre.",
  MISMATCH: "Les deux codes PIN ne sont pas identiques.",
};

export async function firstAccessAction(_prev: FirstAccessState, formData: FormData): Promise<FirstAccessState> {
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");
  const result = await completeFirstAccess(
    db,
    {
      phone,
      code,
      pin: String(formData.get("pin") ?? ""),
      pinConfirmation: String(formData.get("pinConfirmation") ?? ""),
    },
    env.encryptionKey,
    await getRequestMeta(),
  );
  if (!result.ok) {
    // Code invalide ou trop d'essais : on ne le réaffiche pas
    const keepCode = result.problem !== "INVALID" && result.problem !== "LOCKED";
    return { status: "error", message: MESSAGES[result.problem], phone, code: keepCode ? code : "" };
  }
  return { status: "done" };
}
