"use server";

import { db } from "@/db";
import { getRequestMeta } from "@/lib/request-meta";
import { activateAccount, MIN_PASSWORD_LENGTH, type ActivationResult } from "@/lib/auth/activation";

export type ActivateState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; email: string };

const MESSAGES: Record<Exclude<ActivationResult, { ok: true }>["problem"], string> = {
  WEAK_PASSWORD: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  MISMATCH: "Les deux mots de passe ne sont pas identiques.",
  INVALID: "Ce lien n'est pas valide. Demandez un nouveau lien.",
  EXPIRED: "Ce lien a expiré. Demandez un nouveau lien.",
  USED: "Ce lien a déjà été utilisé.",
  ALREADY_ACTIVE: "Ce compte est déjà activé.",
};

export async function activateAction(token: string, _prev: ActivateState, formData: FormData): Promise<ActivateState> {
  const result = await activateAccount(
    db,
    token,
    String(formData.get("password") ?? ""),
    String(formData.get("confirmation") ?? ""),
    await getRequestMeta(),
  );
  if (!result.ok) return { status: "error", message: MESSAGES[result.problem] };
  return { status: "done", email: result.email };
}
