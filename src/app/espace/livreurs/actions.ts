"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { addCourier, CourierError } from "@/lib/couriers/couriers";

type Fields = Partial<Record<"name" | "phone" | "employmentType", string>>;

export type AddCourierState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields: Fields; values: { name: string; phone: string; employmentType: string } }
  | { status: "done"; message: string };

export async function addCourierAction(_prev: AddCourierState, formData: FormData): Promise<AddCourierState> {
  const actor = await requireUser(); // droits revérifiés dans addCourier (matrice §4.2)
  const values = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    employmentType: String(formData.get("employmentType") ?? ""),
  };
  try {
    const r = await addCourier(db, actor, values);
    refresh();
    const message = r.created
      ? `${r.name} est ajouté à vos livreurs.`
      : r.reattached
        ? `${r.name} est de nouveau rattaché à votre entreprise.`
        : `Ce numéro a déjà un compte livreur Ofika : il est maintenant rattaché à votre entreprise sous le nom « ${r.name} ».`;
    return { status: "done", message };
  } catch (e) {
    if (e instanceof CourierError) {
      return { status: "error", message: e.fields ? undefined : e.message, fields: e.fields ?? {}, values };
    }
    throw e;
  }
}
