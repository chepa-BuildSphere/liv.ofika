"use client";

import { useActionState, useState } from "react";
import { compressImageToDataUrl } from "@/lib/media/compress-image";
import { isSafeMediaUrl } from "@/lib/media/safe-url";
import { forceDeliverAction, type ForceDeliverState } from "../actions";

export function ForceDeliveredForm({
  deliveryId,
  reference,
}: {
  deliveryId: string;
  reference: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ForceDeliverState, FormData>(
    forceDeliverAction,
    { status: "idle" },
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileDataUrl("");
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setFileDataUrl(dataUrl);
      setLinkUrl("");
    } catch (err) {
      setFileDataUrl("");
      setPhotoError(err instanceof Error ? err.message : "Image invalide.");
    }
  }

  const effectiveAttachment = fileDataUrl || linkUrl;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Validation manuelle (admin entreprise)</p>
          <p className="text-xs text-ink-muted">
            À utiliser si le client ne peut pas scanner le QR (téléphone déchargé, colis remis à un proche…).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary"
        >
          Forcer Livré
        </button>
      </div>
    );
  }

  const fields = state.status === "error" ? state.fields : {};

  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-warning/30 bg-warning-soft/40 p-4 text-sm"
    >
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <input type="hidden" name="attachmentUrl" value={effectiveAttachment} />

      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">Forcer Livré — {reference}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="link text-xs"
        >
          Fermer
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        Le colis passera à « Livré (forcé) » (preuve manuelle) avec horodatage et identité enregistrés. Il sera compté dans la facturation.
      </p>

      <label className="field-label text-xs">
        Motif obligatoire (3 caractères minimum)
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={1000}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex. Client a confirmé par appel téléphonique, téléphone déchargé lors de la remise…"
          aria-invalid={!!fields.reason}
          className="input h-auto py-2 text-sm"
        />
        {fields.reason && <span className="field-error text-xs">{fields.reason}</span>}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label text-xs">
          Capture ou photo (facultative)
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-xs text-ink-muted"
          />
        </label>

        {!fileDataUrl && (
          <label className="field-label text-xs">
            Ou lien vers une pièce jointe (facultatif)
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="input h-9 text-sm"
            />
          </label>
        )}
      </div>

      {photoError && <p className="field-error text-xs">{photoError}</p>}
      {fields.attachmentUrl && <p className="field-error text-xs">{fields.attachmentUrl}</p>}

      {fileDataUrl && isSafeMediaUrl(fileDataUrl) && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileDataUrl}
            alt="Pièce jointe"
            className="h-16 w-16 rounded border border-line object-cover"
          />
          <button
            type="button"
            onClick={() => setFileDataUrl("")}
            className="link text-xs"
          >
            Retirer la pièce jointe
          </button>
        </div>
      )}

      {state.status === "error" && state.message && (
        <p role="alert" className="alert-error text-xs">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn-primary h-9 px-4 text-xs">
          {pending ? "Validation…" : "Confirmer « Livré (forcé) »"}
        </button>
      </div>
    </form>
  );
}
