"use client";

import { useActionState, useState } from "react";
import type { DeliveryStatus } from "@/lib/deliveries/transitions";
import { formatPhone } from "@/lib/validation";
import {
  cancelDeliveryAction,
  updateDeliveryAction,
  type CancelDeliveryState,
  type UpdateDeliveryState,
} from "./actions";

export type DeliveryRowEditable = {
  id: string;
  reference: string;
  status: DeliveryStatus;
  recipientName: string;
  recipientPhone: string;
  address: string;
  district: string | null;
  packageDescription: string | null;
  amountToCollect: number | null;
  comment: string | null;
};

export function DeliveryRowActions({ delivery }: { delivery: DeliveryRowEditable }) {
  const [mode, setMode] = useState<"closed" | "edit" | "cancel">("closed");
  const [editState, editAction, editPending] = useActionState(async (prev: UpdateDeliveryState, fd: FormData) => {
    const result = await updateDeliveryAction(prev, fd);
    if (result.status === "saved") setMode("closed");
    return result;
  }, { status: "idle" });

  const [cancelState, cancelAction, cancelPending] = useActionState(async (prev: CancelDeliveryState, fd: FormData) => {
    const result = await cancelDeliveryAction(prev, fd);
    if (result.status === "done") setMode("closed");
    return result;
  }, { status: "idle" });

  const beforePickup = delivery.status === "CREATED" || delivery.status === "ASSIGNED";
  if (!beforePickup) return null;

  const fields = editState.status === "error" ? editState.fields : {};
  const values = editState.status === "error" ? editState.values : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMode(mode === "edit" ? "closed" : "edit")}
        >
          Modifier
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMode(mode === "cancel" ? "closed" : "cancel")}
        >
          Annuler
        </button>
      </div>

      {mode === "edit" && (
        <form action={editAction} className="card flex flex-col gap-3 bg-surface p-4">
          <input type="hidden" name="deliveryId" value={delivery.id} />
          <p className="text-sm font-medium">Modifier la livraison {delivery.reference}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Référence
              <input
                name="reference"
                required
                defaultValue={values?.reference ?? delivery.reference}
                aria-invalid={!!fields.reference}
                className="input h-10 text-sm"
              />
              {fields.reference && <span className="field-error">{fields.reference}</span>}
            </label>
            <label className="field-label">
              Montant à encaisser (F CFA, facultatif)
              <input
                name="amountToCollect"
                inputMode="numeric"
                defaultValue={
                  values?.amountToCollect ??
                  (delivery.amountToCollect !== null ? String(delivery.amountToCollect) : "")
                }
                aria-invalid={!!fields.amountToCollect}
                className="input h-10 text-sm"
              />
              {fields.amountToCollect && <span className="field-error">{fields.amountToCollect}</span>}
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Nom du destinataire
              <input
                name="recipientName"
                required
                defaultValue={values?.recipientName ?? delivery.recipientName}
                aria-invalid={!!fields.recipientName}
                className="input h-10 text-sm"
              />
              {fields.recipientName && <span className="field-error">{fields.recipientName}</span>}
            </label>
            <label className="field-label">
              Téléphone du destinataire
              <input
                name="recipientPhone"
                type="tel"
                inputMode="tel"
                required
                defaultValue={values?.recipientPhone ?? formatPhone(delivery.recipientPhone)}
                aria-invalid={!!fields.recipientPhone}
                className="input h-10 text-sm"
              />
              {fields.recipientPhone && <span className="field-error">{fields.recipientPhone}</span>}
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Adresse de livraison
              <input
                name="address"
                required
                defaultValue={values?.address ?? delivery.address}
                aria-invalid={!!fields.address}
                className="input h-10 text-sm"
              />
              {fields.address && <span className="field-error">{fields.address}</span>}
            </label>
            <label className="field-label">
              Quartier / commune (facultatif)
              <input
                name="district"
                defaultValue={values?.district ?? delivery.district ?? ""}
                aria-invalid={!!fields.district}
                className="input h-10 text-sm"
              />
              {fields.district && <span className="field-error">{fields.district}</span>}
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Description du colis (facultatif)
              <input
                name="packageDescription"
                defaultValue={values?.packageDescription ?? delivery.packageDescription ?? ""}
                aria-invalid={!!fields.packageDescription}
                className="input h-10 text-sm"
              />
              {fields.packageDescription && <span className="field-error">{fields.packageDescription}</span>}
            </label>
            <label className="field-label">
              Commentaire (facultatif)
              <input
                name="comment"
                defaultValue={values?.comment ?? delivery.comment ?? ""}
                aria-invalid={!!fields.comment}
                className="input h-10 text-sm"
              />
              {fields.comment && <span className="field-error">{fields.comment}</span>}
            </label>
          </div>

          {editState.status === "error" && editState.message && (
            <p role="alert" className="alert-error">
              {editState.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={editPending} className="btn-primary h-9 px-4 text-sm">
              {editPending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" disabled={editPending} className="btn-secondary" onClick={() => setMode("closed")}>
              Fermer
            </button>
          </div>
        </form>
      )}

      {mode === "cancel" && (
        <form action={cancelAction} className="flex flex-col gap-3 rounded-lg border border-danger/20 bg-danger-soft p-3 text-xs">
          <input type="hidden" name="deliveryId" value={delivery.id} />
          <p className="text-ink">
            Annuler la livraison <span className="font-mono font-medium">{delivery.reference}</span> ? Elle ne pourra plus être livrée.
          </p>
          <label className="field-label text-xs">
            Motif d&apos;annulation (facultatif)
            <input name="reason" placeholder="Ex. commande annulée par le client" className="input h-9 text-xs" />
          </label>
          {cancelState.status === "error" && <p role="alert" className="text-danger">{cancelState.message}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={cancelPending} className="btn-primary h-9 px-3 text-xs">
              {cancelPending ? "Annulation…" : "Confirmer l'annulation"}
            </button>
            <button type="button" disabled={cancelPending} className="btn-secondary" onClick={() => setMode("closed")}>
              Retour
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
