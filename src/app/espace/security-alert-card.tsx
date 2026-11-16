"use client";

import { useState } from "react";
import type { DashboardSecurityAlert } from "@/lib/dashboard/dashboard";
import { resolveSecurityAlertAction } from "./actions";

export function SecurityAlertCard({ alert }: { alert: DashboardSecurityAlert }) {
  const [isResolving, setIsResolving] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  if (resolved) {
    return null;
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append("alertId", alert.id);
    formData.append("notes", notes);

    const res = await resolveSecurityAlertAction(formData);
    setPending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setResolved(true);
    }
  }

  const details = alert.details ?? {};
  const deliveryIds = Array.isArray(details.deliveryIds) ? (details.deliveryIds as string[]) : [];
  const fingerprint = typeof details.clientDeviceFingerprint === "string" ? details.clientDeviceFingerprint : null;

  return (
    <div className="rounded-xl border border-danger/40 bg-danger/5 p-5 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-danger px-2 py-0.5 text-[11px] font-bold uppercase text-white">
              Alerte sécurité critique
            </span>
            <span className="font-semibold text-danger">
              {alert.type === "SUSPICIOUS_DEVICE_REUSE"
                ? "Suspicion de second téléphone livreur (réutilisation d'appareil)"
                : alert.type}
            </span>
          </div>

          <p className="mt-2 text-xs text-ink-muted leading-relaxed">
            Le même terminal client a validé plusieurs livraisons distinctes pour le livreur{" "}
            <strong>{alert.courierName ?? "Inconnu"}</strong>. Cela indique une forte probabilité de fraude
            (le livreur utilise son propre second appareil pour valider à la place du destinataire).
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {alert.courierName && (
              <div>
                <span className="text-ink-muted">Livreur : </span>
                <span className="font-medium text-ink">{alert.courierName}</span>
              </div>
            )}
            {alert.deliveryReference && (
              <div>
                <span className="text-ink-muted">Livraison détectée : </span>
                <span className="font-mono font-medium text-ink">{alert.deliveryReference}</span>
              </div>
            )}
            {fingerprint && (
              <div>
                <span className="text-ink-muted">Empreinte client : </span>
                <span className="font-mono text-ink-muted">{fingerprint.slice(0, 16)}…</span>
              </div>
            )}
            {deliveryIds.length > 0 && (
              <div>
                <span className="text-ink-muted">Livraisons liées : </span>
                <span className="font-medium text-ink">{deliveryIds.length} colis</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsResolving(!isResolving)}
          className="shrink-0 self-start btn-secondary text-xs"
        >
          {isResolving ? "Annuler" : "Traiter l'alerte"}
        </button>
      </div>

      {isResolving && (
        <form onSubmit={handleResolve} className="mt-4 border-t border-danger/20 pt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              Commentaire de résolution (ex. &apos;Explications vérifiées auprès du client et du livreur&apos;)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motif ou notes d'audit…"
              className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsResolving(false)}
              className="btn-secondary text-xs"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary text-xs"
            >
              {pending ? "Validation…" : "Marquer comme résolue"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
