"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { importDeliveriesFromCsv, type CsvImportError } from "@/lib/deliveries/csv-import";
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

const MAX_CSV_BYTES = 1_000_000;

export type ImportDeliveriesState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; totalRows: number; importedCount: number; errors: CsvImportError[] };

export async function importDeliveriesAction(
  _prev: ImportDeliveriesState,
  formData: FormData,
): Promise<ImportDeliveriesState> {
  const actor = await requireUser();
  const fileEntry = formData.get("file");
  const pasted = String(formData.get("csvText") ?? "");

  let csvText = "";
  if (fileEntry instanceof File && fileEntry.size > 0) {
    if (fileEntry.size > MAX_CSV_BYTES) {
      return { status: "error", message: "Fichier trop volumineux (1 Mo maximum)." };
    }
    csvText = await fileEntry.text();
  } else {
    csvText = pasted;
  }

  if (!csvText.trim()) {
    return { status: "error", message: "Sélectionnez un fichier CSV ou collez vos lignes depuis Excel." };
  }

  try {
    const result = await importDeliveriesFromCsv(db, actor, csvText, await getRequestMeta());
    if (!result.ok) {
      return { status: "error", message: result.message };
    }
    if (result.importedCount > 0) refresh();
    return {
      status: "done",
      totalRows: result.totalRows,
      importedCount: result.importedCount,
      errors: result.errors,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", message: e.message };
    }
    throw e;
  }
}
