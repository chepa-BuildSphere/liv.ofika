"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { createDelivery, DeliveryError, type DeliveryField } from "@/lib/deliveries/deliveries";
import { getRequestMeta } from "@/lib/request-meta";

type Fields = Partial<Record<DeliveryField, string>>;

type FormValues = {
  reference: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  district: string;
  packageDescription: string;
  amountToCollect: string;
  comment: string;
  proofMode: string;
};

export type CreateDeliveryState =
  | { status: "idle" }
  | { status: "error"; message?: string; fields: Fields; values: FormValues }
  | { status: "done"; message: string; reference: string };

export async function createDeliveryAction(_prev: CreateDeliveryState, formData: FormData): Promise<CreateDeliveryState> {
  const actor = await requireUser();
  const values: FormValues = {
    reference: String(formData.get("reference") ?? ""),
    recipientName: String(formData.get("recipientName") ?? ""),
    recipientPhone: String(formData.get("recipientPhone") ?? ""),
    address: String(formData.get("address") ?? ""),
    district: String(formData.get("district") ?? ""),
    packageDescription: String(formData.get("packageDescription") ?? ""),
    amountToCollect: String(formData.get("amountToCollect") ?? ""),
    comment: String(formData.get("comment") ?? ""),
    proofMode: String(formData.get("proofMode") ?? "QR"),
  };

  try {
    const created = await createDelivery(db, actor, values, await getRequestMeta());
    refresh();
    return {
      status: "done",
      reference: created.reference,
      message: `Livraison ${created.reference} créée (statut : Créée).`,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return {
        status: "error",
        message: e.fields ? undefined : e.message,
        fields: e.fields ?? {},
        values,
      };
    }
    throw e;
  }
}
