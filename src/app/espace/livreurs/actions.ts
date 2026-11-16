"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { env } from "@/env";
import { requireUser } from "@/lib/auth/user-session";
import { addCourier, CourierError, detachCourier } from "@/lib/couriers/couriers";
import { FirstAccessError, issueAccessCode } from "@/lib/couriers/first-access";

type Fields = Partial<Record<"name" | "phone" | "employmentType", string>>;

/** Code d'accès à montrer une seule fois à l'entreprise. */
export type AccessCodeView = { code: string; expiresAt: string; courierName: string; phone: string };

export type AddCourierState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields: Fields; values: { name: string; phone: string; employmentType: string } }
  | { status: "done"; message: string; access: AccessCodeView | null };

export async function addCourierAction(_prev: AddCourierState, formData: FormData): Promise<AddCourierState> {
  const actor = await requireUser(); // droits revérifiés dans addCourier (matrice §4.2)
  const values = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    employmentType: String(formData.get("employmentType") ?? ""),
  };
  try {
    const r = await addCourier(db, actor, values);
    // Pas encore de PIN : on génère tout de suite son code de premier accès
    const issued = r.hasPin ? null : await issueAccessCode(db, actor, r.courierId, env.encryptionKey);
    refresh();
    const message = r.created
      ? `${r.name} est ajouté à vos livreurs.`
      : r.reattached
        ? `${r.name} est de nouveau rattaché à votre entreprise.`
        : `Ce numéro a déjà un compte livreur Ofika : il est maintenant rattaché à votre entreprise sous le nom « ${r.name} ».`;
    return { status: "done", message, access: issued && toView(issued) };
  } catch (e) {
    if (e instanceof CourierError) {
      return { status: "error", message: e.fields ? undefined : e.message, fields: e.fields ?? {}, values };
    }
    throw e;
  }
}

export type IssueCodeState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; access: AccessCodeView };

export async function issueCodeAction(_prev: IssueCodeState, formData: FormData): Promise<IssueCodeState> {
  const actor = await requireUser();
  try {
    const issued = await issueAccessCode(db, actor, String(formData.get("courierId") ?? ""), env.encryptionKey);
    return { status: "done", access: toView(issued) };
  } catch (e) {
    if (e instanceof FirstAccessError) return { status: "error", message: e.message };
    throw e;
  }
}

function toView(i: { code: string; expiresAt: Date; courierName: string; phone: string }): AccessCodeView {
  return { code: i.code, expiresAt: i.expiresAt.toISOString(), courierName: i.courierName, phone: i.phone };
}

export type DetachCourierState = { status: "idle" } | { status: "error"; message: string } | { status: "done" };

export async function detachCourierAction(_prev: DetachCourierState, formData: FormData): Promise<DetachCourierState> {
  const actor = await requireUser();
  try {
    await detachCourier(db, actor, String(formData.get("courierId") ?? ""));
    refresh();
    return { status: "done" };
  } catch (e) {
    if (e instanceof CourierError) return { status: "error", message: e.message };
    throw e;
  }
}
