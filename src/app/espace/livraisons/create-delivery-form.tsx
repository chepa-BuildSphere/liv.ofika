"use client";

import { useActionState, useState } from "react";
import { createDeliveryAction, type CreateDeliveryState } from "./actions";

/** Remonter le formulaire (nouvelle clé) remet les champs et l'état à zéro. */
export function CreateDeliveryForm() {
  const [round, setRound] = useState(0);
  return <Inner key={round} startOpen={round > 0} onAgain={() => setRound((n) => n + 1)} />;
}

function Inner({ startOpen, onAgain }: { startOpen: boolean; onAgain: () => void }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState<CreateDeliveryState, FormData>(createDeliveryAction, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          {state.message}
        </p>
        <button type="button" className="btn-secondary self-start" onClick={onAgain}>
          Créer une autre livraison
        </button>
      </div>
    );
  }

  if (!open && state.status === "idle") {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Nouvelle livraison
      </button>
    );
  }

  const fields = state.status === "error" ? state.fields : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} className="card flex flex-col gap-4 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Nouvelle livraison</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Référence de commande
          <input
            name="reference"
            required
            placeholder="CMD-1042"
            defaultValue={values?.reference}
            aria-invalid={!!fields.reference}
            className="input"
          />
          {fields.reference && <span className="field-error">{fields.reference}</span>}
        </label>

        <label className="field-label">
          Montant à encaisser (F CFA, facultatif)
          <input
            name="amountToCollect"
            inputMode="numeric"
            placeholder="15000"
            defaultValue={values?.amountToCollect}
            aria-invalid={!!fields.amountToCollect}
            className="input"
          />
          {fields.amountToCollect && <span className="field-error">{fields.amountToCollect}</span>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Nom du destinataire
          <input
            name="recipientName"
            required
            placeholder="Awa Koné"
            defaultValue={values?.recipientName}
            aria-invalid={!!fields.recipientName}
            className="input"
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
            placeholder="07 07 07 07 07"
            defaultValue={values?.recipientPhone}
            aria-invalid={!!fields.recipientPhone}
            className="input"
          />
          {fields.recipientPhone && <span className="field-error">{fields.recipientPhone}</span>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Adresse de livraison
          <input
            name="address"
            required
            placeholder="Rue des Jardins, immeuble Bleu"
            defaultValue={values?.address}
            aria-invalid={!!fields.address}
            className="input"
          />
          {fields.address && <span className="field-error">{fields.address}</span>}
        </label>

        <label className="field-label">
          Quartier / commune (facultatif)
          <input
            name="district"
            placeholder="Cocody"
            defaultValue={values?.district}
            aria-invalid={!!fields.district}
            className="input"
          />
          {fields.district && <span className="field-error">{fields.district}</span>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Description du colis (facultatif)
          <input
            name="packageDescription"
            placeholder="2 paires de chaussures"
            defaultValue={values?.packageDescription}
            aria-invalid={!!fields.packageDescription}
            className="input"
          />
          {fields.packageDescription && <span className="field-error">{fields.packageDescription}</span>}
        </label>

        <label className="field-label">
          Commentaire (facultatif)
          <input
            name="comment"
            placeholder="Appeler avant de passer"
            defaultValue={values?.comment}
            aria-invalid={!!fields.comment}
            className="input"
          />
          {fields.comment && <span className="field-error">{fields.comment}</span>}
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Mode de preuve</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="proofMode"
              value="QR"
              defaultChecked={(values?.proofMode ?? "QR") === "QR"}
              className="size-4 accent-brand-strong"
            />
            QR code + code à 4 chiffres
          </label>
          <span className="flex items-center gap-2 text-ink-muted">
            <input type="radio" disabled className="size-4" />
            QR + OTP (bientôt disponible)
          </span>
        </div>
        {fields.proofMode && <p className="field-error mt-2">{fields.proofMode}</p>}
      </fieldset>

      {state.status === "error" && state.message && (
        <p role="alert" className="alert-error">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Création…" : "Créer la livraison"}
        </button>
        <button type="button" className="btn-secondary h-11" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
