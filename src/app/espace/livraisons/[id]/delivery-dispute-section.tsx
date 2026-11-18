"use client";

import { useState } from "react";
import { openDisputeAction, resolveDisputeAction } from "./mvp1-actions";

type DisputeItem = {
  id: string;
  reason: string;
  status: string;
  description: string;
  resolutionNotes: string | null;
  resolvedByUserName: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

const DISPUTE_REASONS = [
  { value: "PACKAGE_NOT_RECEIVED", label: "Colis non reçu par le destinataire" },
  { value: "PACKAGE_DAMAGED", label: "Marchandise endommagée ou manquante" },
  { value: "PAYMENT_DISCREPANCY", label: "Écart de paiement / encaissement" },
  { value: "WRONG_ITEMS", label: "Article non conforme à la commande" },
  { value: "OTHER", label: "Autre motif" },
];

export function DeliveryDisputeSection({
  deliveryId,
  disputes,
  canManage,
}: {
  deliveryId: string;
  disputes: DisputeItem[];
  canManage: boolean;
}) {
  const [showOpenForm, setShowOpenForm] = useState(false);

  return (
    <section aria-label="Gestion des litiges" className="card space-y-4 p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-warning">Gestion des litiges & contentieux</h2>
          {disputes.length > 0 && (
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
              {disputes.length} dossier{disputes.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {canManage && !showOpenForm && (
          <button
            type="button"
            onClick={() => setShowOpenForm(true)}
            className="btn-secondary text-xs text-warning hover:border-warning"
          >
            + Déclarer un litige
          </button>
        )}
      </div>

      {disputes.length === 0 && !showOpenForm && (
        <p className="text-xs text-ink-muted">Aucun litige ouvert sur cette livraison.</p>
      )}

      {disputes.map((d) => (
        <div
          key={d.id}
          className={`space-y-2 rounded-lg border p-4 ${
            d.status === "OPEN"
              ? "border-warning/30 bg-warning-soft/20"
              : "border-line bg-surface"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-ink">
              Motif : {DISPUTE_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                d.status === "OPEN"
                  ? "bg-warning text-white"
                  : d.status === "RESOLVED"
                    ? "bg-success text-white"
                    : "bg-ink-muted text-white"
              }`}
            >
              {d.status === "OPEN"
                ? "EN COURS"
                : d.status === "RESOLVED"
                  ? "RÉSOLU"
                  : "REJETÉ"}
            </span>
          </div>

          <p className="text-sm">{d.description}</p>

          {d.resolutionNotes && (
            <div className="mt-2 rounded border border-line bg-surface p-2 text-xs">
              <span className="font-semibold">Résolution ({d.resolvedByUserName ?? "Admin"}) :</span>{" "}
              {d.resolutionNotes}
            </div>
          )}

          {canManage && d.status === "OPEN" && (
            <form action={resolveDisputeAction} className="mt-3 space-y-2 border-t border-line/50 pt-2">
              <input type="hidden" name="deliveryId" value={deliveryId} />
              <input type="hidden" name="disputeId" value={d.id} />
              <input
                type="text"
                name="resolutionNotes"
                required
                placeholder="Indiquez la conclusion de l'enquête ou l'accord trouvé..."
                className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="status"
                  value="RESOLVED"
                  className="rounded bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  Clôturer comme Résolu
                </button>
                <button
                  type="submit"
                  name="status"
                  value="REJECTED"
                  className="rounded bg-line px-3 py-1 text-xs font-medium text-ink hover:bg-line-strong"
                >
                  Rejeter le litige
                </button>
              </div>
            </form>
          )}
        </div>
      ))}

      {showOpenForm && (
        <form
          action={async (formData) => {
            await openDisputeAction(formData);
            setShowOpenForm(false);
          }}
          className="space-y-3 rounded-lg border border-warning/40 bg-warning-soft/30 p-4"
        >
          <input type="hidden" name="deliveryId" value={deliveryId} />
          <h3 className="font-semibold text-xs text-warning uppercase tracking-wide">
            Ouverture d'un dossier de litige
          </h3>
          <div>
            <label htmlFor="reason" className="block text-xs font-medium text-ink">
              Motif du litige
            </label>
            <select
              id="reason"
              name="reason"
              required
              className="mt-1 w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs"
            >
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-ink">
              Description circonstanciée
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="Expliquez en détail l'incident survenu lors de la livraison ou le retour client..."
              className="mt-1 w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOpenForm(false)}
              className="btn-secondary text-xs"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary text-xs bg-warning hover:bg-warning-strong">
              Enregistrer le litige
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
