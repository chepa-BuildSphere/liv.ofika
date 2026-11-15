"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { activationUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/auth/user-session";
import { inviteUser, regenerateTeamLink, setUserActive, TeamError, updateUserRoles } from "@/lib/team/team";

// Chaque action relit l'utilisateur connecté (rôles à jour) : le formulaire
// n'est jamais une preuve de droit. Les règles sont dans lib/team/team.ts.

type Fields = Partial<Record<"name" | "email" | "phone" | "roles", string>>;

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields: Fields; values: { name: string; email: string; phone: string; roles: string[] } }
  | { status: "done"; url: string; expiresAt: string; name: string; phone: string | null };

export async function inviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const actor = await requireUser();
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    roles: formData.getAll("roles").map(String),
  };
  try {
    const { user, token, expiresAt } = await inviteUser(db, actor, values);
    refresh();
    return { status: "done", url: activationUrl(token), expiresAt: expiresAt.toISOString(), name: user.name, phone: user.phone };
  } catch (e) {
    if (e instanceof TeamError) return { status: "error", message: e.fields ? undefined : e.message, fields: e.fields ?? {}, values };
    throw e;
  }
}

export type MemberActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved" }
  | { status: "link"; url: string; expiresAt: string; name: string };

export async function updateRolesAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const actor = await requireUser();
  try {
    await updateUserRoles(db, actor, String(formData.get("userId") ?? ""), formData.getAll("roles").map(String));
    refresh();
    return { status: "saved" };
  } catch (e) {
    if (e instanceof TeamError) return { status: "error", message: e.message };
    throw e;
  }
}

export async function toggleActiveAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const actor = await requireUser();
  try {
    await setUserActive(db, actor, String(formData.get("userId") ?? ""), formData.get("active") === "true");
    refresh();
    return { status: "saved" };
  } catch (e) {
    if (e instanceof TeamError) return { status: "error", message: e.message };
    throw e;
  }
}

export async function regenerateLinkAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const actor = await requireUser();
  try {
    const r = await regenerateTeamLink(db, actor, String(formData.get("userId") ?? ""));
    refresh();
    return { status: "link", url: activationUrl(r.token), expiresAt: r.expiresAt.toISOString(), name: r.name };
  } catch (e) {
    if (e instanceof TeamError) return { status: "error", message: e.message };
    throw e;
  }
}
